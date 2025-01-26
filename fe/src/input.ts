export interface DirectionInputs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
export interface DirectionCallback {
  (direction: DirectionInputs): void;
}

export class InputManager {
  activated: boolean;
  direction: DirectionInputs;
  directionCallbacks: DirectionCallback[] = [];

  constructor(activated: boolean = false) {
    this.activated = activated;
    this.direction = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    document.addEventListener("keydown", (e) => this.onKeyDown(e), false);
    document.addEventListener("keyup", (e) => this.onKeyUp(e), false);
  }

  public setActivated(activated: boolean) {
    this.activated = activated;
    if (!activated) {
      this.direction = {
        up: false,
        down: false,
        left: false,
        right: false,
      };
      this.directionCallbacks.forEach((e) => e(this.direction));
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    if (!this.activated) return;
    switch (event.code) {
      case "KeyW":
        this.direction.up = true;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyA":
        this.direction.left = true;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyS":
        this.direction.down = true;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyD":
        this.direction.right = true;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      default:
        return;
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    if (!this.activated) return;
    switch (event.code) {
      case "KeyW":
        this.direction.up = false;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyA":
        this.direction.left = false;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyS":
        this.direction.down = false;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      case "KeyD":
        this.direction.right = false;
        this.directionCallbacks.forEach((e) => e(this.direction));
        break;
      default:
        return;
    }
  }
}
