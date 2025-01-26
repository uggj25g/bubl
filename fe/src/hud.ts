import * as T from "../../types";

export class HudManager {
  _red: HTMLElement;
  _blue: HTMLElement;
  _energy: HTMLElement;
  _location: HTMLElement;

  constructor() {
    this._red = document.getElementById("red-num")!;
    this._blue = document.getElementById("blue-num")!;
    this._energy = document.getElementById("energy-num")!;
    this._location = document.getElementById("loc-num")!;
  }

  public setRedScore(score: number) {
    this._red.innerText = score.toFixed(0);
  }

  public setBlueScore(score: number) {
    this._blue.innerText = score.toFixed(0);
  }

  public setEnergy(energy: number) {
    this._energy.innerText = energy.toFixed(0);
  }

  public setLocation(location: T.CubeLocation) {
    this._location.innerText = location;
  }
}
