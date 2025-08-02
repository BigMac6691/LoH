import * as THREE from 'three';
import { UIController } from './UIController.js';
import { MapGenerator } from './MapGenerator.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.z = 500;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ 
  canvas: document.getElementById('gameCanvas'),
  antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Create a spinning cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshPhongMaterial({ 
  color: 0x00ff88,
  shininess: 100
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

scene.add(new THREE.AxesHelper(5));
scene.add(new THREE.GridHelper(20, 20));
const controls = new OrbitControls(camera, renderer.domElement);

// Add some additional cubes for visual interest
const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });

const demoCubes = [];
for (let i = 0; i < 5; i++) {
  const smallCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  smallCube.position.set(
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10
  );
  smallCube.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  scene.add(smallCube);
  demoCubes.push(smallCube);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Rotate the main cube
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  
  // Rotate demo cubes
  demoCubes.forEach(demoCube => {
    demoCube.rotation.x += 0.005;
    demoCube.rotation.y += 0.005;
  });

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize UI Controller and Map Generator
let uiController;
let mapGenerator;

// Function to remove demo objects when generating map
function removeDemoObjects() {
  // Remove main cube
  scene.remove(cube);
  cube.geometry.dispose();
  cube.material.dispose();
  
  // Remove demo cubes
  demoCubes.forEach(demoCube => {
    scene.remove(demoCube);
    demoCube.geometry.dispose();
    demoCube.material.dispose();
  });
  demoCubes.length = 0; // Clear the array
}

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  // Initialize UI Controller and Map Generator
  uiController = new UIController();
  mapGenerator = new MapGenerator(scene);
  
  // Show the map controls on load
  uiController.showPanel();
  
  // Start animation
  animate();
});

// Map generation function
function generateMap(config) {
  console.log('Generating map with config:', config);
  
  // Remove demo objects (spinning cubes) to show only the star map
  removeDemoObjects();
  
  // Generate the map using MapGenerator
  mapGenerator.generateMap(config);
  
  // Get and display statistics
  const stats = mapGenerator.getStats();
  console.log('Map statistics:', stats);
  
  // Show success message with stats
  alert(`Map generated successfully!\n\nMap Size: ${config.mapSize}x${config.mapSize}\nMin Star Density: ${config.minStarDensity}\nMax Star Density: ${config.maxStarDensity}\nSeed: ${config.seed}\n\nStars: ${stats.stars}\nWormholes: ${stats.wormholes}\nAverage stars per sector: ${stats.averageStarsPerSector.toFixed(1)}`);
}

// Make generateMap available globally for the UIController
window.generateMap = generateMap;

// Export for potential use in other modules
export { scene, camera, renderer, cube, generateMap }; 