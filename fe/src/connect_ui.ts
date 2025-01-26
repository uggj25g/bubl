import SOCKET from "./paulsn/ws_client";

export interface PlayCallback {
  (): void;
}

export class ConnectUiManager {
  playCallbacks: PlayCallback[] = [];

  constructor() {
    const connectUi = document.getElementById("connectui")!;

    const connectStateUi = document.getElementById("connecting_state")!;
    connectStateUi.style.display = "block";

    const failedStateUi = document.getElementById("failed_state")!;
    const lobbyStateUi = document.getElementById("lobby_state")!;
    const lobbyPlayButton = document.getElementById("lobby_play_btn")!;
    lobbyPlayButton.onclick = () => {
      connectUi.style.display = "none";
      this.playCallbacks.forEach((e) => e());
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
  }
}
