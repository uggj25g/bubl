export interface Callback {
  (): void;
}

// TODO: Callback renaming, inputs are messy :D
export const TOP_LEFT_CALLBACKS: Callback[] = []; // Q
export const TOP_RIGHT_CALLBACKS: Callback[] = []; // E
export const BOTTOM_LEFT_CALLBACKS: Callback[] = []; // Z
export const BOTTOM_RIGHT_CALLBACKS: Callback[] = []; // C
export const LEFT_CALLBACKS: Callback[] = []; // A
export const RIGHT_CALLBACKS: Callback[] = []; // D

function onKeyDown(event: KeyboardEvent) {
  switch (event.code) {
    case "KeyD":
      // RIGHT
      TOP_LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyE":
      // TOP_RIGHT
      TOP_RIGHT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyA":
      // LEFT
      BOTTOM_LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyZ":
      // BOTTOM_LEFT
      BOTTOM_RIGHT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyQ":
      // TOP_LEFT
      LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyC":
      // BOTTOM RIGHT
      RIGHT_CALLBACKS.forEach((e) => e());
      break;
    default:
      return;
  }
}

document.addEventListener("keydown", onKeyDown, false);
