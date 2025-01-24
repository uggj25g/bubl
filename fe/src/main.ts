import './style.css'

import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// Create hexagonal shape (figure out the geometry a bit later)
const shape = new THREE.Shape();
shape.moveTo(-2, 0);
shape.lineTo(-1, -2);
shape.lineTo(1, -2);
shape.lineTo(2, 0);
shape.lineTo(1, 2);
shape.lineTo(-1, 2);

const extrudeSettings: THREE.ExtrudeGeometryOptions = {
	steps: 2,
	depth: 0.2,
	bevelEnabled: false,
};

const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

cube.rotation.x = THREE.MathUtils.degToRad(90);

camera.rotation.x = THREE.MathUtils.degToRad(-20);
camera.position.y = 5;
camera.position.z = 10;

function animate() {
  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);