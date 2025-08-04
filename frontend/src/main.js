import * as THREE from 'three';
import { UIController } from './UIController.js';
import { MapGenerator } from './MapGenerator.js';
import { PlayerManager } from './PlayerManager.js';
import { PlayerSetupUI } from './PlayerSetupUI.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEV_MODE, autoStartDevMode, logDevModeStatus, setupDevModeEventListeners } from './devScenarios.js';
import { eventBus } from './eventBus.js';

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

// Initialize OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

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
  
  // Update OrbitControls
  controls.update();
  
  // Rotate the main cube
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  
  // Rotate demo cubes
  demoCubes.forEach(demoCube => {
    demoCube.rotation.x += 0.005;
    demoCube.rotation.y += 0.005;
  });

  renderer.render(scene, camera);
  
  // Render star labels if map generator exists
  if (mapGenerator) {
    mapGenerator.renderLabels();
    // Update star interaction manager
    mapGenerator.updateStarInteraction(0.016); // Approximate delta time
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update label renderer size
  if (mapGenerator) {
    mapGenerator.onWindowResize();
    mapGenerator.onStarInteractionResize();
  }
});

// Initialize UI Controller and Map Generator
let uiController;
let mapGenerator;
let playerManager;
let playerSetupUI;

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
  
  // Log development mode status
  logDevModeStatus();
  
  // Initialize UI Controller and Map Generator
  uiController = new UIController();
  mapGenerator = new MapGenerator(scene, camera);
  playerManager = new PlayerManager();
  
  // Start animation
  animate();
  
  // Set up event listeners for game flow
  setupGameEventListeners();
  
  // Handle development mode vs normal flow
  if (DEV_MODE) {
    // Set up dev mode event listeners
    setupDevModeEventListeners(playerManager);
    
    // Skip setup screens and auto-start development scenario
    autoStartDevMode(generateMap);
  } else {
    // Show the map controls on load for normal flow
    uiController.showPanel();
  }
});

// Set up event listeners for game flow
function setupGameEventListeners() {
  // Listen for game start event
  eventBus.on('game:start', (players) => {
    console.log('🎮 Game started with players:', players);
    onGameStart(players);
  });
}

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
  
  // Clear any existing players
  playerManager.clearPlayers();
  
  // Emit map ready event
  const mapModel = mapGenerator.getCurrentModel();
  eventBus.emit('map:ready', mapModel);
  
  // Show player setup screen (only in non-dev mode)
  if (!DEV_MODE) {
    if (playerSetupUI) {
      playerSetupUI.destroy();
    }
    
    playerSetupUI = new PlayerSetupUI(playerManager, mapModel, (players) => {
      // Emit players ready event
      eventBus.emit('players:ready', players);
    });
    playerSetupUI.show();
  }
}

// Game start function
function onGameStart(players) {
  console.log('Game started with players:', players);
  
  // Update star colors to reflect player ownership
  mapGenerator.updateStarColors(players);
}

// Make generateMap available globally for the UIController
window.generateMap = generateMap;

// Make mapGenerator available globally for development scenarios
window.mapGenerator = mapGenerator;

// Export for potential use in other modules
export { scene, camera, renderer, cube, generateMap }; 