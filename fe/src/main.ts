import "./style.css";

import * as THREE from "three";
import * as coordinates from "./coordinates";
import * as T from "../../types";
import SOCKET from "./paulsn/ws_client";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { PlayerManager } from "./player";
import { Environment } from "./visual/environment/scene";
import { InputManager } from "./input";
import { ConnectUiManager } from "./connect_ui";

const environment = new Environment();
const inputManager = new InputManager(false);
const rpm = new PlayerManager(environment.scene, inputManager);
const connectUiManager = new ConnectUiManager();
connectUiManager.playCallbacks.push(() => {
  inputManager.activated = true;
});

const composer = new EffectComposer(environment.renderer);

const hexes: coordinates.VisualCell[] = [];
coordinates.for_radius(T.cube(0, 0, 0), coordinates.PLAYING_RADIUS, (coord) => {
  hexes.push(environment.cellManager.get_cell(coord.to_string()));
});

SOCKET.init.then(
  (x) => {
    console.log("socket init!");
    const p = x[0];
    rpm.spawn_client_player(p);
    rpm.client_player?.move(coordinates.CubeCoordinates.from_string(p.location));
    SOCKET.callbacks.onSelfUpdate = (player) => {
      environment.cellManager.offsetActiveCells(player.location);
    }

    SOCKET.callbacks.onCellUpdate = (coord, cell) => {
      environment.hexMap.setCell(coord.to_string(), cell);
    };
    const g = x[1];
    console.log(g);

    for (let [locationKey, cell] of Object.entries(g)) {
      let location = locationKey as T.CubeLocation;
      environment.hexMap.setCell(location, cell)
    }
  },
  (err) => {
    console.log("socket fail!", err);
  },
);

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

  raycaster.setFromCamera(mouse, environment.camera);
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

  if (rpm.client_player?.position) {
    environment.camera.animateCameraPosition(
      rpm.client_player.position.x,
      rpm.client_player.position.z,
      0.05,
    );
  }

  environment.renderScene();
  composer.render();
}
animate();

window.addEventListener("resize", () => {
  environment.renderer.setSize(window.innerWidth, window.innerHeight);
  environment.camera.aspect = window.innerWidth / window.innerHeight;
  environment.camera.updateProjectionMatrix();
});

environment.renderer.domElement.addEventListener("mousemove", onMouseMove);

environment.renderer.domElement.addEventListener("click", () => {
  // if (selectedHoverHex) {
  //   if (selectedHoverHex.cell.state == T.CellState.BLANK) {
  //     environment.hexMap.setCell(selectedHoverHex.location, {
  //       state: T.CellState.TRAIL,
  //     });
  //   } else if (selectedHoverHex.cell.state == T.CellState.TRAIL) {
  //     environment.hexMap.setCell(selectedHoverHex.location, undefined);
  //   }
  // }
});
