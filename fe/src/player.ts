import * as THREE from "three";
import SOCKET from "./paulsn/ws_client";
import * as T from "../../types";
import * as coordinates from "./coordinates";
import * as input from "./input";

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

  public spawn_client_player(state: T.PlayerState): void {
    const player = new Player(state);
    this.scene.add(player);
    this.client_player = player;

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
  }

  public spawnRemotePlayer(state: T.PlayerState): void {
    const player = new Player(state);
    this.remote_players.push(player);
    this.scene.add(player);
  }

  public updateRemotePlayer(state: T.PlayerState): void {
    console.log(`got remote update: ${JSON.stringify(state)}`);
    const player = this.remote_players.find((p) => p.id === state.id);
    if (!player) {
      return;
    }
    player.setLocation(state.location);
  }

  public despawnRemotePlayer(state: T.PlayerState): void {
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
  mesh: THREE.Mesh;
  cubepos: coordinates.CubeCoordinates;

  constructor(state: T.PlayerState) {
    super();
    this.remote_id = state.id;
    this.color = state.color;
    this.cubepos = coordinates.CubeCoordinates.from_string(state.location);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const geometry = new THREE.SphereGeometry(0.1);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 1;
    this.add(this.mesh);
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

  public static remote_spawn(state: T.PlayerState): void {}

  public remote_move(state: T.PlayerState): void {}
}