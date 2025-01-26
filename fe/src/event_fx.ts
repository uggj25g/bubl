import * as THREE from "three";
import * as T from "../../types";
import { Timer } from "three/addons/misc/Timer.js";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CubeCoordinates } from "./coordinates";
import JEASINGS from "jeasings";

enum GridEventColor {
  Red,
  Blue,
  Annihilate,
}

export class EventFxManager {
  scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public onGridEvent(message: T.GridEventMessage) {
    if (message.type == T.GridEventType.FILL) {
      this.scene.add(
        new Popup(
          message.location,
          message.teamScore?.toString() ?? "-",
          message.team != 0 ? GridEventColor.Blue : GridEventColor.Red,
        ),
      );
    } else if (message.type == T.GridEventType.ANNIHILATE) {
      this.scene.add(
        new Popup(message.location, "Annihilated!", GridEventColor.Annihilate),
      );
    }
  }
}

export class Popup extends THREE.Group {
  color: T.Integer;
  timer: Timer;
  text: CSS2DObject | undefined;
  despawned: boolean = false;

  startTime: number;
  middleTime: number;
  endTime: number;

  constructor(location: T.CubeLocation, text: string, color: GridEventColor) {
    super();
    this.position.copy(CubeCoordinates.from_string(location).to_planar_unit3());

    const element = document.createElement("p");
    element.innerText = text;
    element.classList.add("hud-gridevent");
    switch (color) {
      case GridEventColor.Annihilate:
        element.classList.add("hud-gridevent-annihilate");
        break;
      case GridEventColor.Red:
        element.classList.add("hud-gridevent-red-score");
        break;
      case GridEventColor.Blue:
        element.classList.add("hud-gridevent-blue-score");
        break;
    }
    this.text = new CSS2DObject(element);
    this.text.position.y = 0;
    this.add(this.text);

    this.color = color;
    this.timer = new Timer();

    this.startTime = this.timer.getElapsed();
    this.middleTime = this.startTime + 1.5;
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

    if (time > this.startTime && time < this.endTime) {
      if (time < this.middleTime) {
        const t = (time - this.startTime) / (this.middleTime - this.startTime);
        this.position.y = THREE.MathUtils.lerp(0, 2, JEASINGS.Elastic.Out(t));
      } else {
        this.position.y = 2;
      }
    }

    requestAnimationFrame((e) => this.animate(e));
  }
}

export class AnnihilatePopup extends THREE.Group {}
