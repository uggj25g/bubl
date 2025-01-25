import "../style.css";

import * as THREE from "three";
import * as coordinates from "../coordinates";
import * as T from "../../../types";
import * as G from '../../../be/src/grid';
import { annihilate } from '../../../be/src/grid_algo';

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

type Hex = coordinates.VisualCell & {
  cellColor?: T.Integer;
};

const hexes = [] as Array<Hex>;
coordinates.for_radius(T.cube(0, 0, 0), 5, (coord) => {
  hexes.push(cellManager.get_cell(coord.to_string()));
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedHoverHex: Hex | undefined = undefined;

function onMouseMove(event: MouseEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function isVisualCell(t: any): t is Hex {
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

renderer.domElement.addEventListener('click', (ev) => {
  if (selectedHoverHex) {
    selectedHoverHex.updateCell({ state: T.CellState.TRAIL, color: 1 });
    selectedHoverHex.mesh.material = new THREE.MeshStandardMaterial({ color: 0xff00000 });
  }
});
renderer.domElement.addEventListener('contextmenu', (ev) => {
  if (selectedHoverHex) {
    selectedHoverHex.updateCell({ state: T.CellState.TRAIL, color: 2 });
    selectedHoverHex.mesh.material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  }
});
renderer.domElement.addEventListener('dblclick', () => {
  if (selectedHoverHex) {
    let interimGrid = Object.create(null) as G.GCellInterimGrid;
    for (let hex of hexes) {
      if (hex.cell.color === undefined) continue;
      interimGrid[hex.location] = {
        state: T.CellState.TRAIL,
        color: hex.cell.color!,
        location: G.str_cube(hex.location),
        ownerPlayerId: hex.cell.color,
        age: 1,
        maxAge: 1,
      };
    }

    annihilate(G.str_cube(selectedHoverHex.location), interimGrid);
    for (let hex of hexes) {
      if (hex.location in interimGrid) {
        let cell = interimGrid[hex.location];
        if (cell.state === T.CellState.BLANK) {
          hex.cell.color = undefined;
          hex.updateCell({ state: T.CellState.BLANK });
        }
      } else {
        hex.cell.color = undefined;
        hex.updateCell({ state: T.CellState.BLANK });
      }
    }
  }

});

// renderer.domElement.addEventListener("click", () => {
//   if (selectedHoverHex && !selectedHexes.includes(selectedHoverHex)) {
//     selectedHoverHex.material = new THREE.MeshStandardMaterial({
//       color: 0x0000ff,
//     });
//     selectedHexes.push(selectedHoverHex);
//   }
// });
