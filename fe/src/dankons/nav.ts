import "./../style.css";

import * as THREE from "three";
import * as coordinates from "../coordinates";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth - 50, window.innerHeight - 50);
document.body.appendChild(renderer.domElement);

const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const geometry = new THREE.SphereGeometry(0.25);
const hexes = coordinates.HexMap.generate(10);
for (const [key, _] of hexes.map) {
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  const coords = coordinates.CubeCoordinates.from_string(key);
  const planar = coords.to_planar_unit();
  sphere.position.x = planar.x;
  sphere.position.z = planar.y;
}

camera.rotation.x = THREE.MathUtils.degToRad(-90);
camera.position.y = 30;
camera.position.z = 0;

function animate() {
  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
