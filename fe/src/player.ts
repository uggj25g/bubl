import * as THREE from "three";
import SOCKET from "./paulsn/ws_client";
import * as T from "../../types";
import * as coordinates from "./coordinates";
import * as input from "./input";

import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { Timer } from "three/addons/misc/Timer.js";
import JEASINGS from "jeasings";
import { CSS2DObject } from "three/examples/jsm/Addons.js";
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
    SOCKET.callbacks.onPlayerUpdate = (e) => this.updateRemotePlayer(e);
    SOCKET.callbacks.onPlayerDespawn = (e) => this.despawnRemotePlayer(e);
  }

  public spawn_client_player(state: T.SelfPlayerState): void {
    const player = new Player(state);
    this.scene.add(player);
    this.client_player = player;
    this.inputManager.directionCallbacks.push((e) =>
      player.setDirectionInput(e),
    );
  }

  public spawnRemotePlayer(state: T.RemotePlayerState): void {
    const player = new Player(state);
    this.remote_players.push(player);
    this.scene.add(player);
  }

  public updateRemotePlayer(state: T.RemotePlayerState): void {
    console.log(`got remote update: ${JSON.stringify(state)}`);
    const player = this.remote_players.find((p) => p.remote_id === state.id);
    if (!player) {
      return;
    }
    player.setRemoteState(state);
  }

  public despawnRemotePlayer(state: T.RemotePlayerState): void {
    console.log(`got despawn color: ${JSON.stringify(state)}`);
    const player = this.remote_players.find((p) => p.remote_id === state.id);
    if (!player) {
      return;
    }
    this.scene.remove(player);
    this.remote_players = this.remote_players.filter(
      (p) => p.remote_id === state.id,
    );
  }
}

interface TransitionData {
  begin: THREE.Vector3;
  middle: THREE.Vector3;
  end: THREE.Vector3;
  beginTime: number;
  middleTime: number;
  endTime: number;
}

export class Player extends THREE.Group {
  remote_id: T.Integer;
  color: T.Integer;
  remote_name: string;

  mesh: THREE.Group = new THREE.Group();
  cubepos: coordinates.CubeCoordinates;

  timer: Timer;
  nextMoveTime: number;
  currentMoveDelta: coordinates.CubeCoordinates;

  nametag: CSS2DObject;

  _transition: TransitionData | undefined;

  // TODO[paulsn] type discards energy information for client player
  constructor(state: T.RemotePlayerState) {
    super();
    this.loadModel();
    this.remote_id = state.id;
    this.color = state.color;
    this.remote_name = state.name;
    this.cubepos = coordinates.CubeCoordinates.from_string(state.location);
    this.mesh.position.y = 1;
    this.add(this.mesh);
    this.updateObject();

    const nameElement = document.createElement("p");
    nameElement.innerText = state.name;
    nameElement.classList.add("hud-nametag");
    this.nametag = new CSS2DObject(nameElement);
    this.nametag.position.y = 3;
    this.add(this.nametag);

    this.timer = new Timer();
    this.nextMoveTime = 0;
    this.currentMoveDelta = new coordinates.CubeCoordinates();
    this._transition = undefined;

    this.setLocation(state.location);
    this.setColor(state.color);

    requestAnimationFrame((e) => this.animate(e));
  }

  public animate(timestamp: number) {
    // Handle current input direction if this is a player character
    this.timer.update(timestamp);
    const time = this.timer.getElapsed();
    if (!this.currentMoveDelta.isZero() && time >= this.nextMoveTime) {
      this.nextMoveTime = time + 0.2;
      //   const start = this.cubepos;
      this.move(this.currentMoveDelta);
      const end = this.cubepos;
      this.beginTransition(this.position, end, time);
    }

    if (this._transition) {
      if (time < this._transition.beginTime) {
        this.position.copy(this._transition.begin);
      } else if (time > this._transition.endTime) {
        this.position.copy(this._transition.end);
        this._transition = undefined;
      } else {
        if (time < this._transition.middleTime) {
          const t =
            (time - this._transition.beginTime) /
            (this._transition.middleTime - this._transition.beginTime);
          this.position.x = THREE.MathUtils.lerp(
            this._transition.begin.x,
            this._transition.middle.x,
            JEASINGS.Cubic.InOut(t),
          );
          this.position.y = THREE.MathUtils.lerp(
            this._transition.begin.y,
            this._transition.middle.y,
            JEASINGS.Back.InOut(t),
          );
          this.position.z = THREE.MathUtils.lerp(
            this._transition.begin.z,
            this._transition.middle.z,
            JEASINGS.Cubic.InOut(t),
          );
        } else {
          const t =
            (time - this._transition.middleTime) /
            (this._transition.endTime - this._transition.middleTime);
          this.position.x = THREE.MathUtils.lerp(
            this._transition.middle.x,
            this._transition.end.x,
            JEASINGS.Elastic.Out(t),
          );
          this.position.y = THREE.MathUtils.lerp(
            this._transition.middle.y,
            this._transition.end.y,
            JEASINGS.Elastic.Out(t),
          );
          this.position.z = THREE.MathUtils.lerp(
            this._transition.middle.z,
            this._transition.end.z,
            JEASINGS.Elastic.Out(t),
          );
        }
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

  private beginTransition(
    from: THREE.Vector3,
    to: coordinates.CubeCoordinates,
    time: number,
  ) {
    // Aniamtion cycle:
    // Stage 1 - pump down, move tonew cell
    // Stage 2 - pump up with elastic ease
    this._transition = {
      beginTime: time,
      middleTime: time + 0.15,
      endTime: time + 1.3,
      begin: from.clone(),
      middle: to.to_planar_unit3().add(new THREE.Vector3(0, -0.3, 0)),
      end: to.to_planar_unit3().add(new THREE.Vector3(0, 0.3, 0)),
    };
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

  private setLocation(position: T.CubeLocation) {
    // Trying to move to same location
    if (position == this.cubepos.to_string()) return;

    this.cubepos = coordinates.CubeCoordinates.from_string(position);
    this.beginTransition(this.position, this.cubepos, this.timer.getElapsed());
  }

  private setColor(color: T.Integer) {
    console.log(`set player color: ${color}`);
    this.color = color;
    if (color == 0) {
      this.nametag.element.classList.remove("hud-nametag-blue");
      this.nametag.element.classList.add("hud-nametag-red");
    } else if (color == 1) {
      this.nametag.element.classList.remove("hud-nametag-red");
      this.nametag.element.classList.add("hud-nametag-blue");
    } else {
      this.nametag.element.classList.remove("hud-nametag-red");
      this.nametag.element.classList.remove("hud-nametag-blue");
    }
  }

  private setName(name: string) {
    this.remote_name = name;
    console.log(`set player name: ${name}`);
    this.nametag.element.innerText = name;
  }

  public move(translation: coordinates.CubeCoordinates) {
    this.cubepos = this.cubepos.translated(translation);
    SOCKET.setLocation(this.cubepos.to_string());
  }

  public setRemoteState(state: T.RemotePlayerState) {
    // If location is different, start move animation
    const new_location = state.location;
    if (new_location != this.cubepos.to_string()) {
      this.setLocation(new_location);
    }
    // If color is different, change color
    if (state.color != this.color) {
      this.setColor(state.color);
    }
    // If name is different, rebuild name tag
    if (state.name != this.remote_name) {
      this.setName(state.name);
    }
  }
}
