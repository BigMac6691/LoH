import * as THREE from 'three';
import { UIController } from './UIController.js';
import { MapViewGenerator } from './MapViewGenerator.js';
import { PlayerManager } from './PlayerManager.js';
import { PlayerSetupUI } from './PlayerSetupUI.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEV_MODE, autoStartDevMode, logDevModeStatus, setupDevModeEventListeners } from './devScenarios.js';
import { eventBus } from './eventBus.js';
import { assetManager } from './engine/AssetManager.js';
import { SystemEventHandler } from './SystemEventHandler.js';
import { DevEventHandler } from './DevEventHandler.js';

import { BackendTestPanel } from './dev/BackendTestPanel.js';

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

// Add lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x999999, 0.3);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
directionalLight.position.copy(camera.position);
scene.add(directionalLight);

// Initialize OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Animation loop
function animate()
{
  requestAnimationFrame(animate);
  
  // Update OrbitControls
  controls.update();

  renderer.render(scene, camera);
  
  // Render star labels if map generator exists
  if (mapGenerator)
  {
    mapGenerator.renderLabels();
    // Update star interaction manager
    mapGenerator.updateStarInteraction(0.016); // Approximate delta time
  }
}

// Handle window resize
window.addEventListener('resize', () =>
{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update label renderer size
  if (mapGenerator)
  {
    mapGenerator.onWindowResize();
    mapGenerator.onStarInteractionResize();
  }
});

// Initialize UI Controller and Map Generator
let uiController;
let mapGenerator;
let playerManager;
let playerSetupUI;
let systemEventHandler;
let devEventHandler;

let backendTestPanel;

// Start loading assets immediately (before DOM ready)
console.log('🎨 Starting asset loading...');
assetManager.loadFont('fonts/helvetiker_regular.typeface.json')
  .catch(error =>
  {
    console.warn('⚠️ Could not load font for 3D labels:', error.message);
  });

assetManager.loadGLTF('models/toy_rocket_4k_free_3d_model_gltf/scene.gltf')
  .catch(error =>
  {
    console.warn('⚠️ Could not load rocket model for fleet icons:', error.message);
  });

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () =>
{
  const loadingElement = document.getElementById('loading');
  if (loadingElement)
  {
    loadingElement.style.display = 'none';
  }
  
  // Log development mode status
  logDevModeStatus();
  
  // Initialize UI Controller and Map Generator
  uiController = new UIController();
  mapGenerator = new MapViewGenerator(scene, camera);
  playerManager = new PlayerManager();
  
  // Initialize system event handler
  systemEventHandler = new SystemEventHandler();
  
  // Initialize development event handler
  devEventHandler = new DevEventHandler();
  
  // Initialize backend test panel if in dev mode
  if (DEV_MODE > 0)
  {
    // Initialize backend test panel (includes all dev tools)
    backendTestPanel = new BackendTestPanel(scene, renderer, camera, mapGenerator);
    backendTestPanel.show(); // Show backend test panel by default in dev mode
  }
  
  // Start animation
  animate();
  
  // Set up event listeners for game flow
  setupGameEventListeners();
  
  // Handle development mode vs normal flow
  if (DEV_MODE === 2)
  {
    // Set up dev mode event listeners
    setupDevModeEventListeners(playerManager);
    
    // Start the development scenario immediately
    // Font loading will be handled by AssetManager events automatically
    autoStartDevMode();
  } else
  {
    // Show the map controls on load for normal flow
    uiController.showPanel();
  }
});

// Set up event listeners for game flow
function setupGameEventListeners()
{
  // Listen for game start event
  eventBus.on('game:start', (players) =>
  {
    console.log('🎮 Game started with players:', players);
    onGameStart(players);
  });
}

// Game start function
function onGameStart(players)
{
  console.log('Game started with players:', players);
  
  // Update star colors to reflect player ownership
  mapGenerator.updateStarColors(players);
  
  // Fleet icons are now handled automatically in updateStarGroups()
  // No need to manually create them here
}

// Make mapGenerator available globally for development scenarios
window.mapGenerator = mapGenerator;

// Export for potential use in other modules
export { scene, camera, renderer }; 