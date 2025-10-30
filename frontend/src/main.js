import * as THREE from 'three';
import { UIController } from './UIController.js';
import { MapViewGenerator } from './MapViewGenerator.js';
import { PlayerManager } from './PlayerManager.js';
import { PlayerSetupUI } from './PlayerSetupUI.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEV_MODE, autoStartDevMode, logDevModeStatus, setupDevModeEventListeners } from './devScenarios.js';
import { eventBus } from './eventBus.js';
import { assetManager } from './engine/AssetManager.js';
import { SystemEventHandler, GameEventHandler, DevEventHandler, OrderEventHandler, TurnEventHandler } from './events/index.js';
import { MapModel } from '@loh/shared';

import { DevPanel } from './dev/DevPanel.js';
import { TurnEventsPanel } from './TurnEventsPanel.js';

// Global MapModel instance
window.globalMapModel = null;

// Global instances
let turnEventsPanel = new TurnEventsPanel();

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
let gameEventHandler;
let devEventHandler;
let orderEventHandler;
let turnEventHandler;

let devPanel;

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
  
  // Create refresh button and events button
  createRefreshButton();
  createEventsButton();
  
  // Log development mode status
  logDevModeStatus();
  
  // Initialize UI Controller and Map Generator
  uiController = new UIController();
  mapGenerator = new MapViewGenerator(scene, camera);
  playerManager = new PlayerManager();
  
  // Initialize system event handler
  systemEventHandler = new SystemEventHandler();
  
  // Initialize game event handler
  gameEventHandler = new GameEventHandler();
  
  // Initialize development event handler
  devEventHandler = new DevEventHandler();
  
  // Initialize order event handler
  orderEventHandler = new OrderEventHandler();
  
  // Initialize turn event handler
  turnEventHandler = new TurnEventHandler();
  
  // Initialize dev panel if in dev mode
  if (DEV_MODE > 0)
  {
    // Initialize dev panel (includes all dev tools)
    devPanel = new DevPanel(scene, renderer, camera, mapGenerator);
    devPanel.show(); // Show dev panel by default in dev mode
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
  eventBus.on('game:start', (context, players) =>
  {
    console.log('🎮 Game started with players:', players);
    console.log('🎮 Game context:', context);
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

// Create refresh button
function createRefreshButton()
{
  const refreshButton = document.createElement('button');
  refreshButton.id = 'refresh-button';
  refreshButton.innerHTML = '🔄 Refresh';
  refreshButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    padding: 10px 15px;
    background: rgba(0, 255, 136, 0.2);
    border: 2px solid #00ff88;
    border-radius: 8px;
    color: #00ff88;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  `;
  
  // Hover effects
  refreshButton.addEventListener('mouseenter', () => {
    refreshButton.style.background = 'rgba(0, 255, 136, 0.3)';
    refreshButton.style.transform = 'scale(1.05)';
    refreshButton.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.5)';
  });
  
  refreshButton.addEventListener('mouseleave', () => {
    refreshButton.style.background = 'rgba(0, 255, 136, 0.2)';
    refreshButton.style.transform = 'scale(1)';
    refreshButton.style.boxShadow = 'none';
  });
  
  // Click handler
  refreshButton.addEventListener('click', () => {
    console.log('🔄 Refresh button clicked - emitting game:startGame event');
    eventBus.emit('game:startGame', {
      success: true,
      details: {
        eventType: 'game:startGame',
        reason: 'manual_refresh'
      }
    });
  });
  
  // Add to DOM
  document.body.appendChild(refreshButton);
}

// Create events button
function createEventsButton()
{
  const eventsButton = document.createElement('button');
  eventsButton.id = 'events-button';
  eventsButton.innerHTML = '📝 Events';
  eventsButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 120px;
    z-index: 1000;
    padding: 10px 15px;
    background: rgba(0, 150, 255, 0.2);
    border: 2px solid #0096ff;
    border-radius: 8px;
    color: #0096ff;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  `;
  
  // Hover effects
  eventsButton.addEventListener('mouseenter', () => {
    eventsButton.style.background = 'rgba(0, 150, 255, 0.3)';
    eventsButton.style.transform = 'scale(1.05)';
    eventsButton.style.boxShadow = '0 0 15px rgba(0, 150, 255, 0.5)';
  });
  
  eventsButton.addEventListener('mouseleave', () => {
    eventsButton.style.background = 'rgba(0, 150, 255, 0.2)';
    eventsButton.style.transform = 'scale(1)';
    eventsButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
  });
  
  // Click handler
  eventsButton.addEventListener('click', () => {
    console.log('📝 Events button clicked');
    
    // Initialize turn events panel if not already created
    if (!turnEventsPanel) {
      turnEventsPanel = new TurnEventsPanel();
    }
    
    // Show the panel
    turnEventsPanel.show();
  });
  
  // Add to DOM
  document.body.appendChild(eventsButton);
}

// Make mapGenerator available globally for development scenarios
window.mapGenerator = mapGenerator;

// Export for potential use in other modules
export { scene, camera, renderer }; 