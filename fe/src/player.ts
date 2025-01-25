import * as THREE from "three";
import SOCKET from "./paulsn/ws_client";
import * as T from "../../types";
import * as coordinates from "./coordinates";
import * as input from "./input";

import { FBXLoader } from "three/examples/jsm/Addons.js";
export class PlayerManager {
  scene: THREE.Scene;
  client_player: Player | undefined;
  remote_players: Player[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.remote_players = [];

    SOCKET.callbacks.onPlayerSpawn = (e) => this.spawnRemotePlayer(e);
    SOCKET.callbacks.onPlayerMove = (e) => this.updateRemotePlayer(e);
    SOCKET.callbacks.onPlayerDespawn = (e) => this.despawnRemotePlayer(e);
  }

  public spawn_client_player(state: T.SelfPlayerState): void {
    const player = new Player(state);
    this.scene.add(player);
    this.client_player = player;

    input.TOP_RIGHT_CALLBACKS.push(() => {
      player.move(coordinates.CubeCoordinates.TOP_LEFT);
    });
    input.TOP_LEFT_CALLBACKS.push(() => {
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
  }

  public spawnRemotePlayer(state: T.RemotePlayerState): void {
    const player = new Player(state);
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

  // TODO[paulsn] type discards energy information for client player
  constructor(state: T.RemotePlayerState) {
    super();
    this.loadModel();
    this.remote_id = state.id;
    this.color = state.color;
    this.cubepos = coordinates.CubeCoordinates.from_string(state.location);
    this.mesh.position.y = 1;
    this.add(this.mesh);
  }

  private loadModel() {
    const loader = new FBXLoader();
    loader.load('/playermodel.fbx', (fbx) => {
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
