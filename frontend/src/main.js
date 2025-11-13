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
import { SummaryDialog } from './SummaryDialog.js';
import { OrderSummaryDialog } from './OrderSummaryDialog.js';

// Global MapModel instance
window.globalMapModel = null;

// Global player lookup Map (playerId -> player object)
window.globalPlayers = null;

// Global instances
let turnEventsPanel = new TurnEventsPanel();
let summaryDialog = null;
let orderSummaryDialog = null;

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
  
  // Create button container for top-right buttons
  createButtonContainer();
  
  // Create refresh button, events button, and end turn button
  createRefreshButton();
  createEventsButton();
  createSummaryButton();
  createOrderButton();
  createEndTurnButton();
  
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

// Create button container for top-right buttons
function createButtonContainer()
{
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'top-right-buttons';
  buttonContainer.className = 'top-right-buttons-container';
  document.body.appendChild(buttonContainer);
}

// Create refresh button
function createRefreshButton()
{
  const refreshButton = document.createElement('button');
  refreshButton.id = 'refresh-button';
  refreshButton.className = 'top-right-button top-right-button-refresh';
  refreshButton.innerHTML = '🔄 Refresh';
  
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
    const gameId = eventBus.getContext().gameId;
    
    if (!gameId) {
      console.error('🔄 Refresh button clicked but no game ID found in context');
      alert('Error: No game loaded. Please start a game first.');
      return;
    }
    
    console.log('🔄 Refresh button clicked - emitting game:startGame event for game', gameId);
    eventBus.emit('game:startGame', {
      gameId
    });
  });
  
  // Add to container
  const container = document.getElementById('top-right-buttons');
  if (container) {
    container.appendChild(refreshButton);
  }
}

// Create events button
function createEventsButton()
{
  const eventsButton = document.createElement('button');
  eventsButton.id = 'events-button';
  eventsButton.className = 'top-right-button top-right-button-events';
  eventsButton.innerHTML = '📝 Events';
  
  // Hover effects
  eventsButton.addEventListener('mouseenter', () => {
    eventsButton.style.background = 'rgba(0, 150, 255, 0.3)';
    eventsButton.style.transform = 'scale(1.05)';
    eventsButton.style.boxShadow = '0 0 15px rgba(0, 150, 255, 0.5)';
  });
  
  eventsButton.addEventListener('mouseleave', () => {
    eventsButton.style.background = 'rgba(0, 150, 255, 0.2)';
    eventsButton.style.transform = 'scale(1)';
    eventsButton.style.boxShadow = 'none';
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
  
  // Add to container
  const container = document.getElementById('top-right-buttons');
  if (container) {
    container.appendChild(eventsButton);
  }
}

// Create summary button
function createSummaryButton()
{
  const summaryButton = document.createElement('button');
  summaryButton.id = 'summary-button';
  summaryButton.className = 'top-right-button top-right-button-summary';
  summaryButton.innerHTML = '📊 Summary';

  summaryButton.addEventListener('mouseenter', () => {
    summaryButton.style.background = 'rgba(255, 215, 0, 0.28)';
    summaryButton.style.transform = 'scale(1.05)';
    summaryButton.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
  });

  summaryButton.addEventListener('mouseleave', () => {
    summaryButton.style.background = 'rgba(255, 215, 0, 0.18)';
    summaryButton.style.transform = 'scale(1)';
    summaryButton.style.boxShadow = 'none';
  });

  summaryButton.addEventListener('click', () => {
    if (!summaryDialog) {
      summaryDialog = new SummaryDialog();
      window.summaryDialog = summaryDialog;
    }

    if (summaryDialog.isOpen()) {
      summaryDialog.hide();
    } else {
      summaryDialog.show();
    }
  });

  // Add to container
  const container = document.getElementById('top-right-buttons');
  if (container) {
    container.appendChild(summaryButton);
  }
}

// Create order button
function createOrderButton()
{
  const orderButton = document.createElement('button');
  orderButton.id = 'order-button';
  orderButton.className = 'top-right-button top-right-button-order';
  orderButton.innerHTML = '📋 Orders';

  orderButton.addEventListener('mouseenter', () => {
    orderButton.style.background = 'rgba(135, 206, 250, 0.28)';
    orderButton.style.transform = 'scale(1.05)';
    orderButton.style.boxShadow = '0 0 15px rgba(135, 206, 250, 0.5)';
  });

  orderButton.addEventListener('mouseleave', () => {
    orderButton.style.background = 'rgba(135, 206, 250, 0.18)';
    orderButton.style.transform = 'scale(1)';
    orderButton.style.boxShadow = 'none';
  });

  orderButton.addEventListener('click', () => {
    if (!orderSummaryDialog) {
      orderSummaryDialog = new OrderSummaryDialog();
      window.orderSummaryDialog = orderSummaryDialog;
    }

    if (orderSummaryDialog.isOpen()) {
      orderSummaryDialog.hide();
    } else {
      orderSummaryDialog.show();
    }
  });

  // Add to container
  const container = document.getElementById('top-right-buttons');
  if (container) {
    container.appendChild(orderButton);
  }
}

// Create end turn button
function createEndTurnButton()
{
  const endTurnButton = document.createElement('button');
  endTurnButton.id = 'end-turn-button';
  endTurnButton.className = 'top-right-button top-right-button-end-turn';
  endTurnButton.innerHTML = '✅ End Turn';
  
  // Hover effects
  endTurnButton.addEventListener('mouseenter', () => {
    endTurnButton.style.background = 'rgba(255, 165, 0, 0.3)';
    endTurnButton.style.transform = 'scale(1.05)';
    endTurnButton.style.boxShadow = '0 0 15px rgba(255, 165, 0, 0.5)';
  });
  
  endTurnButton.addEventListener('mouseleave', () => {
    endTurnButton.style.background = 'rgba(255, 165, 0, 0.2)';
    endTurnButton.style.transform = 'scale(1)';
    endTurnButton.style.boxShadow = 'none';
  });
  
  // Click handler
  endTurnButton.addEventListener('click', () => {
    const context = eventBus.getContext();
    const gameId = context?.gameId;
    const playerId = context?.user;
    
    if (!gameId || !playerId) {
      console.error('✅ End Turn button clicked but missing gameId or playerId in context');
      alert('Error: No game loaded or player not set. Please start a game first.');
      return;
    }
    
    console.log(`✅ End Turn button clicked - ending turn for player ${playerId} in game ${gameId}`);
    
    // Emit end turn event (same format as DevPanel)
    eventBus.emit('turn:endTurn', {
      success: true,
      details: {
        eventType: 'turn:endTurn',
        playerId: playerId
      }
    });
    
    // Disable button to prevent multiple clicks
    endTurnButton.disabled = true;
    endTurnButton.textContent = '✅ Turn Ended';
    endTurnButton.style.opacity = '0.6';
    endTurnButton.style.cursor = 'not-allowed';
    
    // Re-enable button after a short delay (in case of errors)
    setTimeout(() => {
      // Only re-enable if still disabled (if turn ended successfully, leave it disabled)
      if (endTurnButton.disabled) {
        // The TurnEventHandler will emit 'turn:endTurnSuccess' if successful
        // Listen for that event to keep button disabled on success
      }
    }, 1000);
  });
  
  // Listen for turn end success to keep button disabled
  eventBus.on('turn:endTurnSuccess', () => {
    const button = document.getElementById('end-turn-button');
    if (button) {
      button.disabled = true;
      button.textContent = '✅ Turn Ended';
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    }
  });
  
  // Listen for turn end error to re-enable button
  eventBus.on('turn:endTurnError', (context, eventData) => {
    const button = document.getElementById('end-turn-button');
    if (button) {
      button.disabled = false;
      button.textContent = '✅ End Turn';
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      const errorMessage = eventData?.details?.error || 'Failed to end turn';
      console.error('✅ End Turn button: Error ending turn:', errorMessage);
      alert(`Error ending turn: ${errorMessage}`);
    }
  });
  
  // Listen for game loaded event to reset button when map is refreshed
  eventBus.on('game:gameLoaded', (context, eventData) => {
    // Only reset if the game was successfully loaded
    if (eventData?.success !== false) {
      const button = document.getElementById('end-turn-button');
      if (button) {
        button.disabled = false;
        button.textContent = '✅ End Turn';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        console.log('✅ End Turn button: Reset after game refresh');
      }
    }
  });
  
  // Add to container
  const container = document.getElementById('top-right-buttons');
  if (container) {
    container.appendChild(endTurnButton);
  }
}

// Make mapGenerator available globally for development scenarios
window.mapGenerator = mapGenerator;

// Export for potential use in other modules
export { scene, camera, renderer }; 