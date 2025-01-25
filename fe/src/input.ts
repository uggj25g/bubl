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
  direction: DirectionInputs;
  directionCallbacks: DirectionCallback[] = [];

  constructor() {
    this.direction = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    document.addEventListener("keydown", (e) => this.onKeyDown(e), false);
    document.addEventListener("keyup", (e) => this.onKeyUp(e), false);
  }

  private onKeyDown(event: KeyboardEvent) {
    console.log(`keydown: ${event.code}`);
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
    console.log(`keyup: ${event.code}`);
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
