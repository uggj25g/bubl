import * as THREE from "three";
import * as T from "../../types";
import { Timer } from "three/addons/misc/Timer.js";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CubeCoordinates } from "./coordinates";

export class EventFxManager {
  scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public onGridEvent(message: T.GridEventMessage) {
    if (message.type == T.GridEventType.FILL) {
      this.scene.add(new ScorePopup(message));
    }
  }
}

export class ScorePopup extends THREE.Group {
  color: T.Integer;
  timer: Timer;
  text: CSS2DObject | undefined;
  despawned: boolean = false;

  startTime: number;
  endTime: number;

  constructor(message: T.GridEventMessage) {
    super();
    this.position.copy(
      CubeCoordinates.from_string(message.location).to_planar_unit3(),
    );

    const element = document.createElement("p");
    element.innerText = `${message.teamScore}`;
    element.classList.add("hud-nametag");
    this.text = new CSS2DObject(element);
    this.text.position.y = 0;
    this.add(this.text);

    this.color = 0;
    this.timer = new Timer();

    this.startTime = this.timer.getElapsed();
    this.endTime = this.startTime + 2;
    requestAnimationFrame((e) => this.animate(e));
  }

  public beforeDespawn() {
    this.despawned = true;
    this.timer.dispose();
    if (this.text) {
      this.text.element.remove();
      this.text = undefined;
    }
  }

  public despawn() {
    this.beforeDespawn();
    this.removeFromParent();
  }

  private animate(timestamp: number) {
    if (this.despawned) return;
    this.timer.update(timestamp);
    const time = this.timer.getElapsed();
    if (time > this.endTime) {
      this.despawn();
    }

    requestAnimationFrame((e) => this.animate(e));
  }
}

export class AnnihilatePopup extends THREE.Group {}
