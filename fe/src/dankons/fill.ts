import "../style.css";

import * as THREE from "three";
import * as coordinates from "../coordinates";
import * as T from "../../../types";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { HexagonLine, HexagonMesh } from ".././visual/hegaxon/flat";
// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8c8c8c);

const hexMap = new coordinates.HexMap();

const cellManager = new coordinates.CellManager(scene, hexMap);

//Set up a rendered
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(-30, 50, 30);
dirLight.castShadow = true;
scene.add(dirLight);

const hexes: coordinates.VisualCell[] = [];
coordinates.for_radius(T.cube(0, 0, 0), 5, (coord) => {
  hexes.push(cellManager.get_cell(coord.to_string()));
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHoverHex: coordinates.VisualCell | undefined = undefined;

function onMouseMove(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function isVisualCell(t: any): t is coordinates.VisualCell {
  return typeof t.setHover === "function";
}

function animate() {
  requestAnimationFrame(animate);

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(hexes);

  if (intersects.length > 0) {
    for (const i of intersects) {
      let visualCell = undefined;
      for (const h of hexes) {
        if (h.mesh == i.object) {
          visualCell = h;
          break;
        }
      }

      if (visualCell != selectedHoverHex && visualCell) {
        selectedHoverHex?.setHover(false);
        visualCell.setHover(true);
        selectedHoverHex = visualCell;
      }
    }
  } else {
    if (selectedHoverHex) {
      selectedHoverHex.setHover(false);
    }
    selectedHoverHex = undefined;
  }

  renderer.render(scene, camera);
  composer.render();
}
animate();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  controls.update();
});

renderer.domElement.addEventListener("mousemove", onMouseMove);

renderer.domElement.addEventListener("click", () => {
  if (selectedHoverHex) {
    if (selectedHoverHex.cell.state == T.CellState.BLANK) {
      hexMap.setCell(selectedHoverHex.location, {
        state: T.CellState.TRAIL,
      });
    } else if (selectedHoverHex.cell.state == T.CellState.TRAIL) {
      hexMap.setCell(selectedHoverHex.location, undefined);
    }
  }
});
