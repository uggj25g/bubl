interface Callback {
  (): void;
}

export const TOP_LEFT_CALLBACKS: Callback[] = [];
export const TOP_RIGHT_CALLBACKS: Callback[] = [];
export const BOTTOM_LEFT_CALLBACKS: Callback[] = [];
export const BOTTOM_RIGHT_CALLBACKS: Callback[] = [];
export const LEFT_CALLBACKS: Callback[] = [];
export const RIGHT_CALLBACKS: Callback[] = [];

function onKeyDown(event: KeyboardEvent) {
  switch (event.code) {
    case "KeyW":
      TOP_LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyE":
      TOP_RIGHT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyZ":
      BOTTOM_LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyX":
      BOTTOM_RIGHT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyA":
      LEFT_CALLBACKS.forEach((e) => e());
      break;
    case "KeyD":
      RIGHT_CALLBACKS.forEach((e) => e());
      break;
    default:
      return;
  }
}

document.addEventListener("keydown", onKeyDown, false);
