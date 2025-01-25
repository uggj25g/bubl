import "./../style.css";

import * as THREE from "three";
import * as coordinates from "../coordinates";
import { Player, PlayerManager } from "../player";
import * as input from "../input";
import * as T from "../../../types";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const rpm = new PlayerManager(scene);
const hexmap = new coordinates.HexMap();

import SOCKET from ".././paulsn/ws_client";
SOCKET.init.then(
  (x) => {
    console.log("socket init!");
    const p = x[0];
    rpm.spawn_client_player(p);
    const g = x[1];
    console.log(g);
  },
  (err) => {
    console.log("socket fail!", err);
  },
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

function animate() {
  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
