import * as THREE from "three";
import SOCKET from "./paulsn/ws_client";
import * as T from "../../types";
import * as coordinates from "./coordinates";
import * as input from "./input";

import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { Timer } from "three/addons/misc/Timer.js";
export class PlayerManager {
  scene: THREE.Scene;
  inputManager: input.InputManager;
  client_player: Player | undefined;
  remote_players: Player[];

  constructor(scene: THREE.Scene, inputManager: input.InputManager) {
    this.scene = scene;
    this.remote_players = [];
    this.inputManager = inputManager;

    SOCKET.callbacks.onPlayerSpawn = (e) => this.spawnRemotePlayer(e);
    SOCKET.callbacks.onPlayerMove = (e) => this.updateRemotePlayer(e);
    SOCKET.callbacks.onPlayerDespawn = (e) => this.despawnRemotePlayer(e);
  }

  public spawn_client_player(state: T.SelfPlayerState): void {
    const player = new Player(state, true);
    this.scene.add(player);
    this.client_player = player;
    this.inputManager.directionCallbacks.push((e) =>
      player.setDirectionInput(e),
    );
  }

  public spawnRemotePlayer(state: T.RemotePlayerState): void {
    const player = new Player(state, false);
    this.remote_players.push(player);
    this.scene.add(player);
  }

  public updateRemotePlayer(state: T.RemotePlayerState): void {
    console.log(`got remote update: ${JSON.stringify(state)}`);
    const player = this.remote_players.find((p) => p.id === state.id);
    if (!player) {
      return;
    }
    player.setLocation(state.location);
  }

  public despawnRemotePlayer(state: T.RemotePlayerState): void {
    const player = this.remote_players.find((p) => p.id === state.id);
    if (!player) {
      return;
    }
    this.scene.remove(player);
    this.remote_players = this.remote_players.filter((p) => p.id === state.id);
  }
}

export class Player extends THREE.Group {
  remote_id: T.Integer;
  color: T.Integer;
  mesh: THREE.Group = new THREE.Group();
  cubepos: coordinates.CubeCoordinates;

  inputTimer: Timer | undefined;
  nextMoveTime: number;
  currentMoveDelta: coordinates.CubeCoordinates;

  // TODO[paulsn] type discards energy information for client player
  constructor(state: T.RemotePlayerState, playable: boolean) {
    super();
    this.loadModel();
    this.remote_id = state.id;
    this.color = state.color;
    this.cubepos = coordinates.CubeCoordinates.from_string(state.location);
    this.mesh.position.y = 1;
    this.add(this.mesh);

    if (playable) {
      this.inputTimer = new Timer();
    }
    this.nextMoveTime = 0;
    this.currentMoveDelta = new coordinates.CubeCoordinates();

    requestAnimationFrame((e) => this.animate(e));
  }

  public animate(timestamp: number) {
    // Handle current input direction if this is a player character
    if (this.inputTimer) {
      this.inputTimer.update(timestamp);
      const time = this.inputTimer.getElapsed();
      if (!this.currentMoveDelta.isZero() && time >= this.nextMoveTime) {
        this.nextMoveTime = time + 0.2;
        this.move(this.currentMoveDelta);
      }
    }

    requestAnimationFrame((e) => this.animate(e));
  }

  private loadModel() {
    const loader = new FBXLoader();
    loader.load("/playermodel.fbx", (fbx) => {
      console.log("Loaded");
      fbx.scale.setScalar(0.05);
      fbx.rotateY(11);
      this.mesh.position.y = 0.5;
      this.mesh.add(fbx);
      this.updateObject();
    });
  }

  private updateObject() {
    const coord = this.cubepos.to_planar_unit();
    this.position.x = coord.x;
    this.position.y = 0;
    this.position.z = coord.y;
  }

  public setDirectionInput(direction: input.DirectionInputs) {
    let count = 0;
    if (direction.down) count++;
    if (direction.up) count++;
    if (direction.left) count++;
    if (direction.right) count++;
    let newMoveDelta = new coordinates.CubeCoordinates();
    if (count == 2) {
      if (direction.up && direction.left) {
        newMoveDelta.add(coordinates.CubeCoordinates.LEFT);
      } else if (direction.up && direction.right) {
        newMoveDelta.add(coordinates.CubeCoordinates.TOP_LEFT);
      } else if (direction.down && direction.left) {
        newMoveDelta.add(coordinates.CubeCoordinates.BOTTOM_RIGHT);
      } else if (direction.down && direction.right) {
        newMoveDelta.add(coordinates.CubeCoordinates.RIGHT);
      }
    } else if (count == 1) {
      if (direction.right) {
        newMoveDelta.add(coordinates.CubeCoordinates.TOP_RIGHT);
      } else if (direction.left) {
        newMoveDelta.add(coordinates.CubeCoordinates.BOTTOM_LEFT);
      } else if (direction.down) {
        newMoveDelta.add(coordinates.CubeCoordinates.BOTTOM_RIGHT);
      } else if (direction.up) {
        newMoveDelta.add(coordinates.CubeCoordinates.TOP_LEFT);
      }
    }
    this.currentMoveDelta = newMoveDelta;
  }

  public setLocation(position: T.CubeLocation) {
    this.cubepos = coordinates.CubeCoordinates.from_string(position);
    this.updateObject();
  }

  public move(translation: coordinates.CubeCoordinates) {
    this.cubepos.add(translation);
    this.updateObject();

    SOCKET.setLocation(this.cubepos.to_string());
  }

  public static remote_spawn(state: T.RemotePlayerState): void {}

  public remote_move(state: T.RemotePlayerState): void {}
}
