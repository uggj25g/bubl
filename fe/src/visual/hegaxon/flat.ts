import * as THREE from 'three';
import { HexagonShape } from './shape';

import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export class HexagonMesh extends THREE.Mesh {
  constructor() {
    const material: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF
    });

    super(new HexagonFlatGeometry(), material);
  }
} 

class HexagonFlatGeometry extends THREE.ExtrudeGeometry {
  constructor() {
    const extrudeGeometryOptions: THREE.ExtrudeGeometryOptions = {
      steps: 2,
      depth: 0.1,
      bevelEnabled: false,
    }

    super(new HexagonShape(), extrudeGeometryOptions);
  }
}

export class HexagonLine extends LineSegments2 {
  constructor() {
    const edges = new THREE.EdgesGeometry(new HexagonFlatGeometry());
    const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);
    const lineMaterial = new LineMaterial({ color: 0x000000, linewidth: 3 });

    super(lineGeometry, lineMaterial);
  }
}