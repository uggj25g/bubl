
import * as THREE from "three";

const CAMERA_ANGLE_RADIANS = THREE.MathUtils.degToRad(45);

const DISTANCE = 20;
const HEIGHT = DISTANCE * Math.sin(CAMERA_ANGLE_RADIANS);
const RADIUS = DISTANCE * Math.cos(CAMERA_ANGLE_RADIANS);

const ROTATION_OFFSET = (45 * Math.PI) / 180;

const X_OFFSET = RADIUS * Math.cos(ROTATION_OFFSET);
const Z_OFFSET = RADIUS * Math.sin(ROTATION_OFFSET);

export class EnvironmentCamera extends THREE.PerspectiveCamera {
  constructor() {
    super(50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.position.set(X_OFFSET, HEIGHT, Z_OFFSET);
    this.lookAt(0, 0, 0);
  }

  public animateCameraPosition(targetX: number, targetZ: number, alpha: number) {
    const animation = () => {
      this.position.lerp(new THREE.Vector3(targetX + (DISTANCE / 2), HEIGHT, targetZ + (DISTANCE / 2)), alpha);
    };
    
    requestAnimationFrame(animation);
  }
}
