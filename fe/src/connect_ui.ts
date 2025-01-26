import SOCKET from "./paulsn/ws_client";
import * as T from "../../types";
export interface PlayCallback {
  // If undefined, keep the color set on connect
  (name: string, color: T.Integer | undefined): void;
}

export class ConnectUiManager {
  playCallbacks: PlayCallback[] = [];
  _nameInput: HTMLInputElement;
  _redRadio: HTMLInputElement;
  _blueRadio: HTMLInputElement;

  constructor() {
    const connectUi = document.getElementById("connectui")!;

    const connectStateUi = document.getElementById("connecting_state")!;
    connectStateUi.style.display = "block";

    this._nameInput = document.getElementById(
      "player-name",
    )! as HTMLInputElement;
    this._redRadio = document.getElementById("radio-red")! as HTMLInputElement;
    this._blueRadio = document.getElementById(
      "radio-blue",
    )! as HTMLInputElement;
    const failedStateUi = document.getElementById("failed_state")!;
    const lobbyStateUi = document.getElementById("lobby_state")!;
    const lobbyPlayButton = document.getElementById("lobby_play_btn")!;
    lobbyPlayButton.onclick = () => {
      const cleanName = this.getCleanName(this._nameInput.value);
      if (cleanName) {
        this.playCallbacks.forEach((e) =>
          e(this._nameInput.value, this.getColor()),
        );
        connectUi.style.display = "none";
      } else {
        alert("Name must be 3 to 30 characters");
      }
    };

    SOCKET.init.then(
      (_) => {
        console.log("socket init!");
        connectStateUi.style.display = "none";
        lobbyStateUi.style.display = "block";
        failedStateUi.style.display = "none";
      },
      (_) => {
        connectStateUi.style.display = "none";
        lobbyStateUi.style.display = "none";
        failedStateUi.style.display = "block";
      },
    );
    SOCKET.callbacks.onConnectionLost = () => {
      connectUi.style.display = 'block';
      lobbyStateUi.style.display = 'none';
      failedStateUi.style.display = 'block';
    }
  }

  private getCleanName(new_name: string): string | undefined {
    const value = new_name.trim();
    if (value.length >= 3 && value.length <= 30) {
      return value;
    }
    return undefined;
  }

  private getColor(): T.Integer | undefined {
    const red = this._redRadio.checked;
    const blue = this._blueRadio.checked;
    if (red == blue) {
      return undefined;
    }
    if (red) return 0;
    if (blue) return 1;
    return undefined;
  }

  public updatePlayerName(new_name: string) {
    this._nameInput.value = new_name;
  }

  public updatePlayerColor(new_color: T.Integer) {
    if (new_color == 0) {
      this._redRadio.checked = true;
      this._blueRadio.checked = false;
    } else if (new_color == 1) {
      this._blueRadio.checked = true;
      this._redRadio.checked = false;
    } else {
      this._redRadio.checked = false;
      this._blueRadio.checked = false;
    }
  }
}
