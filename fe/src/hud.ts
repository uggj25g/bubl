import * as T from "../../types";

export class HudManager {
  _red: HTMLElement;
  _blue: HTMLElement;
  _energy: HTMLElement;
  _location: HTMLElement;

  _scoreBarRed: HTMLElement;
  _scoreBarBlue: HTMLElement;

  constructor() {
    this._red = document.getElementById("red-num")!;
    this._blue = document.getElementById("blue-num")!;
    this._energy = document.getElementById("energy-num")!;
    this._location = document.getElementById("loc-num")!;
    this._scoreBarRed = document.getElementById("scorebar-red")!;
    this._scoreBarBlue = document.getElementById("scorebar-blue")!;
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

  public setScorebarValues() {
    const redScore = parseInt(this._red.innerText, 10);
    const blueScore = parseInt(this._blue.innerText, 10);
    const totalScore = redScore + blueScore;
    let redPercentage = 50;
    let bluePercentage = 50;

    if (totalScore > 0) {
      redPercentage = (redScore / totalScore) * 100;
      bluePercentage = (blueScore / totalScore) * 100;
    }

    console.log(`red: ${redPercentage}, blue: ${bluePercentage}`);

    this._scoreBarRed.style.width = `${redPercentage * 3}px`;
    this._scoreBarBlue.style.width = `${bluePercentage * 3}px`;
  }
}
