import './style.css'

import * as THREE from 'three';
import * as coordinates from "./coordinates";
import * as T from "../../types";

import SOCKET from './paulsn/ws_client';
SOCKET.init.then(() => {
  console.log('socket init!');
}, (err) => {
  console.log('socket fail!', err);
});

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { HexagonLine, HexagonMesh } from './visual/hegaxon/flat';
// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8c8c8c);

//Set up a rendered
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

let controls = new OrbitControls(camera, renderer.domElement);

const angleInRadians = Math.PI / 3;
const distance = 20;
const height = distance * Math.sin(angleInRadians);
const radius = distance * Math.cos(angleInRadians);

const rotationOffset = (20 * Math.PI) / 180;
const xOffset = radius * Math.cos(rotationOffset);
const zOffset = radius * Math.sin(rotationOffset);

camera.position.set(xOffset, height, zOffset);

camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
dirLight.position.set(-30, 50, 30);
dirLight.castShadow = true;
scene.add(dirLight);

const shape = new THREE.Shape();
const size = 0.5;
shape.moveTo(size, 0);
for (let i = 1; i <= 6; i++) {
  shape.lineTo(size * Math.cos((i * Math.PI) / 3), size * Math.sin((i * Math.PI) / 3));
}

const hexes: THREE.Mesh[] = [];
coordinates.for_radius(T.cube(0, 0, 0), 3, (coord) => {
  const flatHex = new HexagonMesh();
  const line = new HexagonLine();
  line.add(flatHex);
  const planar = coord.to_planar_unit();
  line.rotateX(Math.PI / 2);
  
  line.position.set(planar.x, 0, planar.y);
  scene.add(line);
  hexes.push(flatHex);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHoverHex: THREE.Mesh | null = null;

function onMouseMove(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

let selectedHexes: THREE.Mesh[] = [];

function animate() {
  requestAnimationFrame(animate);

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(hexes);

  if (intersects.length > 0) {
    if (selectedHoverHex != intersects[0].object) {
      if (selectedHoverHex && !selectedHexes.includes(selectedHoverHex)) {
        selectedHoverHex.material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      }
      selectedHoverHex = intersects[0].object as THREE.Mesh;
      if (!selectedHexes.includes(selectedHoverHex)) {
        selectedHoverHex.material = new THREE.MeshStandardMaterial({ color: 0xFF0000   });
      }
    }
  } else {
    if (selectedHoverHex && !selectedHexes.includes(selectedHoverHex)) {
      selectedHoverHex.material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    }
    selectedHoverHex = null;
  }

  renderer.render(scene, camera);
  composer.render();
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  controls.update();
});

renderer.domElement.addEventListener('mousemove', onMouseMove);

renderer.domElement.addEventListener('click', () => {
  if (selectedHoverHex && !selectedHexes.includes(selectedHoverHex)) {
    selectedHoverHex.material = new THREE.MeshStandardMaterial({ color: 0x0000FF });
    selectedHexes.push(selectedHoverHex);
  }
});