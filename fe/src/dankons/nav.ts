import "./../style.css";

import * as THREE from "three";
import * as coordinates from "../coordinates";
import { Player } from "../player";
import * as input from "../input";
import * as T from "../../../types";

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
coordinates.for_radius(T.cube(0, 0, 0), 3, (coord) => {
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  const planar = coord.to_planar_unit();
  sphere.position.x = planar.x;
  sphere.position.z = planar.y;
});

camera.rotation.x = THREE.MathUtils.degToRad(-90);
camera.position.y = 30;
camera.position.z = 0;

const player = new Player();
scene.add(player);

input.TOP_LEFT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.TOP_LEFT);
});
input.TOP_RIGHT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.TOP_RIGHT);
});
input.BOTTOM_LEFT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.BOTTOM_LEFT);
});
input.BOTTOM_RIGHT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.BOTTOM_RIGHT);
});
input.LEFT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.LEFT);
});
input.RIGHT_CALLBACKS.push(() => {
  player.move(coordinates.CubeCoordinates.RIGHT);
});

function animate() {
  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
