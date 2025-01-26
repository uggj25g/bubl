import * as THREE from "three";
import * as coordinates from "../../coordinates";
import { AmbientLight, DirectionalLight } from "./light";
import { CSS2DRenderer, EffectComposer } from "three/examples/jsm/Addons.js";
import { EnvironmentCamera } from "./camera";

const BACKGROUND = new THREE.Color(0x8c8c8c);

export class BublScene extends THREE.Scene {
  constructor() {
    super();
    this.buildLightning();

    this.background = BACKGROUND;
  }

  private buildLightning() {
    const ambientLight = new AmbientLight();
    this.add(ambientLight);

    const dirLight = new DirectionalLight();
    this.add(dirLight);
  }
}

export class Environment {
  scene: BublScene;
  renderer: THREE.WebGLRenderer;
  nametags: CSS2DRenderer;
  composer: EffectComposer;
  cellManager: coordinates.CellManager;
  hexMap: coordinates.HexMap;
  camera: EnvironmentCamera;

  constructor() {
    const sceneDiv = document.getElementById("scene")!;
    this.scene = new BublScene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.nametags = new CSS2DRenderer({
      element: document.getElementById("nametags")!,
    });
    this.nametags.setSize(window.innerWidth, window.innerHeight);
    this.composer = new EffectComposer(this.renderer);
    this.hexMap = new coordinates.HexMap();
    this.cellManager = new coordinates.CellManager(this.scene, this.hexMap);
    this.camera = new EnvironmentCamera();

    sceneDiv.appendChild(this.renderer.domElement);
  }

  public renderScene() {
    this.renderer.render(this.scene, this.camera);
    this.nametags.render(this.scene, this.camera);
  }
}