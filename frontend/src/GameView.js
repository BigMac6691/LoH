import * as THREE from 'three';
import { UIController } from './UIController.js';
import { MapViewGenerator } from './MapViewGenerator.js';
import { PlayerManager } from './PlayerManager.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEV_MODE, setupDevModeEventListeners } from './devScenarios.js';
import { eventBus } from './eventBus.js';
import { SystemEventHandler, GameEventHandler, DevEventHandler, OrderEventHandler, TurnEventHandler } from './events/index.js';
import { DevPanel } from './dev/DevPanel.js';
import { TurnEventsPanel } from './TurnEventsPanel.js';
import { SummaryDialog } from './SummaryDialog.js';
import { OrderSummaryDialog } from './OrderSummaryDialog.js';
import { ShipSummaryDialog } from './ShipSummaryDialog.js';
import { webSocketManager } from './services/WebSocketManager.js';
import { gameStatePoller } from './services/GameStatePoller.js';

/**
 * GameView - Manages the ThreeJS game map view and all game-related UI
 */
export class GameView {
  constructor() {
    // ThreeJS components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // Game components
    this.uiController = null;
    this.mapGenerator = null;
    this.playerManager = null;
    this.systemEventHandler = null;
    this.gameEventHandler = null;
    this.devEventHandler = null;
    this.orderEventHandler = null;
    this.turnEventHandler = null;
    
    // UI components
    this.devPanel = null;
    this.turnEventsPanel = null;
    this.summaryDialog = null;
    this.orderSummaryDialog = null;
    this.shipSummaryDialog = null;
    
    // Animation
    this.animationFrameId = null;
    this.isVisible = false;
    
    // Canvas element
    this.canvas = null;
  }

  /**
   * Initialize the game view (called once on app startup)
   */
  init() {
    // Get canvas element
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('GameView: Canvas element not found');
      return;
    }

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.z = 500;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x999999, 0.3);
    this.scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.copy(this.camera.position);
    this.scene.add(directionalLight);

    // Initialize OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Initialize game components
    this.uiController = new UIController();
    this.mapGenerator = new MapViewGenerator(this.scene, this.camera);
    this.playerManager = new PlayerManager();

    // Initialize event handlers
    this.systemEventHandler = new SystemEventHandler();
    this.gameEventHandler = new GameEventHandler();
    this.orderEventHandler = new OrderEventHandler();
    this.turnEventHandler = new TurnEventHandler();

    // Initialize dev panel if in dev mode
    if (DEV_MODE > 0) {
      this.devEventHandler = new DevEventHandler();
      this.devPanel = new DevPanel(this.scene, this.renderer, this.camera, this.mapGenerator);
    }

    // Initialize UI dialogs
    this.turnEventsPanel = new TurnEventsPanel();
    this.summaryDialog = null; // Created on demand
    this.orderSummaryDialog = null; // Created on demand
    this.shipSummaryDialog = null; // Created on demand

    // Set up window resize handler
    this.setupResizeHandler();

    // Set up event listeners
    this.setupEventListeners();

    // Create top-right buttons
    this.createButtons();

    // Make mapGenerator available globally for development scenarios
    window.mapGenerator = this.mapGenerator;

    // Set up dev mode event listeners if needed
    if (DEV_MODE > 0) {
      setupDevModeEventListeners(this.playerManager);
    }
  }

  /**
   * Show the game view
   */
  show() {
    if (this.isVisible) return;

    this.isVisible = true;
    
    // Show canvas
    if (this.canvas) {
      this.canvas.style.display = 'block';
    }

    // Show button container
    const buttonContainer = document.getElementById('top-right-buttons');
    if (buttonContainer) {
      buttonContainer.style.display = 'flex';
    }

    // Start animation loop
    this.startAnimation();

    // Show dev panel if in dev mode
    if (DEV_MODE > 0 && this.devPanel) {
      this.devPanel.show();
    }
  }

  /**
   * Hide the game view
   */
  hide() {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Hide canvas
    if (this.canvas) {
      this.canvas.style.display = 'none';
    }

    // Hide button container
    const buttonContainer = document.getElementById('top-right-buttons');
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }

    // Stop animation loop
    this.stopAnimation();

    // Hide all dialogs
    if (this.turnEventsPanel) {
      this.turnEventsPanel.hide();
    }
    if (this.summaryDialog && this.summaryDialog.isOpen()) {
      this.summaryDialog.hide();
    }
    if (this.orderSummaryDialog && this.orderSummaryDialog.isOpen()) {
      this.orderSummaryDialog.hide();
    }
    if (this.shipSummaryDialog && this.shipSummaryDialog.isOpen()) {
      this.shipSummaryDialog.hide();
    }
  }

  /**
   * Start the animation loop
   */
  startAnimation() {
    if (this.animationFrameId) return; // Already running

    const animate = () => {
      if (!this.isVisible) return; // Stop if hidden

      this.animationFrameId = requestAnimationFrame(animate);
      
      // Update OrbitControls
      this.controls.update();

      this.renderer.render(this.scene, this.camera);
      
      // Render star labels if map generator exists
      if (this.mapGenerator) {
        // Update star interaction manager
        this.mapGenerator.updateStarInteraction(0.016); // Approximate delta time
      }
    };

    animate();
  }

  /**
   * Stop the animation loop
   */
  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set up window resize handler
   */
  setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Update label renderer size
      if (this.mapGenerator) {
        this.mapGenerator.onWindowResize();
        this.mapGenerator.onStarInteractionResize();
      }
    });
  }

  /**
   * Set up event listeners for game flow
   */
  setupEventListeners() {
    // Listen for game start event
    eventBus.on('game:start', (context, players) => {
      console.log('🎮 Game started with players:', players);
      console.log('🎮 Game context:', context);
      this.onGameStart(players);
    });
  }

  /**
   * Handle game start
   */
  onGameStart(players) {
    console.log('Game started with players:', players);
    
    // Update star colors to reflect player ownership
    if (this.mapGenerator) {
      this.mapGenerator.updateStarColors(players);
    }
    
    // Fleet icons are now handled automatically in updateStarGroups()
    // No need to manually create them here
  }

  /**
   * Create button container and all top-right buttons
   */
  createButtons() {
    // Create button container
    this.createButtonContainer();
    
    // Create buttons in reverse order (row-reverse means first added = rightmost)
    // Desired order (right to left): Home, End Turn, Ships, Orders, Summary, Events, Refresh
    this.createHomeButton();
    this.createEndTurnButton();
    this.createShipSummaryButton();
    this.createOrderButton();
    this.createSummaryButton();
    this.createEventsButton();
    this.createRefreshButton();
  }

  /**
   * Create button container for top-right buttons
   */
  createButtonContainer() {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'top-right-buttons';
    buttonContainer.className = 'top-right-buttons-container';
    buttonContainer.style.display = 'none'; // Hidden by default
    document.body.appendChild(buttonContainer);
  }

  /**
   * Create home button
   */
  createHomeButton() {
    const homeButton = document.createElement('button');
    homeButton.id = 'home-button';
    homeButton.className = 'top-right-button top-right-button-home';
    homeButton.innerHTML = '🏠 Home';
    
    // Hover effects
    homeButton.addEventListener('mouseenter', () => {
      homeButton.style.background = 'rgba(255, 100, 100, 0.3)';
      homeButton.style.transform = 'scale(1.05)';
      homeButton.style.boxShadow = '0 0 15px rgba(255, 100, 100, 0.5)';
    });
    
    homeButton.addEventListener('mouseleave', () => {
      homeButton.style.background = 'rgba(255, 100, 100, 0.2)';
      homeButton.style.transform = 'scale(1)';
      homeButton.style.boxShadow = 'none';
    });
    
    // Click handler
    homeButton.addEventListener('click', () => {
      console.log('🏠 Home button clicked - returning to home page');
      
      // Leave WebSocket game room
      webSocketManager.leaveGame();
      
      // Stop polling
      gameStatePoller.stopPolling();
      
      // Clear game context
      eventBus.setGameId(null);
      eventBus.setPlayerId(null);
      
      // Hide any open dialogs
      if (this.summaryDialog && this.summaryDialog.isOpen()) {
        this.summaryDialog.hide();
      }
      if (this.orderSummaryDialog && this.orderSummaryDialog.isOpen()) {
        this.orderSummaryDialog.hide();
      }
      if (this.shipSummaryDialog && this.shipSummaryDialog.isOpen()) {
        this.shipSummaryDialog.hide();
      }
      if (this.turnEventsPanel) {
        this.turnEventsPanel.hide();
      }
      
      // Clear the map if mapGenerator exists
      if (this.mapGenerator) {
        this.mapGenerator.clearMap();
      }
      
      // Hide game view
      this.hide();
      
      // Emit event to show home page
      eventBus.emit('game:returnToHome');
    });
    
    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(homeButton);
    }
  }

  /**
   * Create refresh button
   */
  createRefreshButton() {
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

  /**
   * Create events button
   */
  createEventsButton() {
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
      
      // Show the panel
      if (this.turnEventsPanel) {
        this.turnEventsPanel.show();
      }
    });
    
    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(eventsButton);
    }
  }

  /**
   * Create summary button
   */
  createSummaryButton() {
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
      if (!this.summaryDialog) {
        this.summaryDialog = new SummaryDialog();
        window.summaryDialog = this.summaryDialog;
      }

      if (this.summaryDialog.isOpen()) {
        this.summaryDialog.hide();
      } else {
        this.summaryDialog.show();
      }
    });

    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(summaryButton);
    }
  }

  /**
   * Create order button
   */
  createOrderButton() {
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
      if (!this.orderSummaryDialog) {
        this.orderSummaryDialog = new OrderSummaryDialog();
        window.orderSummaryDialog = this.orderSummaryDialog;
      }

      if (this.orderSummaryDialog.isOpen()) {
        this.orderSummaryDialog.hide();
      } else {
        this.orderSummaryDialog.show();
      }
    });

    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(orderButton);
    }
  }

  /**
   * Create end turn button
   */
  createEndTurnButton() {
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
      const playerId = context?.playerId; // Use playerId, not user (user is user_id)
      
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
        
        // Update poller with new turn number if polling is active
        if (eventData.details?.currentTurn && gameStatePoller.isPolling) {
          gameStatePoller.updateTurnNumber(eventData.details.currentTurn.number);
        }
      }
    });
    
    // Listen for WebSocket connection failure to start polling
    eventBus.on('websocket:connectionFailed', () => {
      const context = eventBus.getContext();
      if (context.gameId) {
        console.log('🔄 WebSocket connection failed, starting polling fallback');
        // Poller will be started when game loads, but we can also start it here if needed
      }
    });
    
    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(endTurnButton);
    }
  }

  /**
   * Create ship summary button
   */
  createShipSummaryButton() {
    const shipSummaryButton = document.createElement('button');
    shipSummaryButton.id = 'ship-summary-button';
    shipSummaryButton.className = 'top-right-button top-right-button-ship';
    shipSummaryButton.innerHTML = '🚢 Ships';

    shipSummaryButton.addEventListener('mouseenter', () => {
      shipSummaryButton.style.background = 'rgba(135, 206, 250, 0.3)';
      shipSummaryButton.style.transform = 'scale(1.05)';
      shipSummaryButton.style.boxShadow = '0 0 15px rgba(135, 206, 250, 0.5)';
    });

    shipSummaryButton.addEventListener('mouseleave', () => {
      shipSummaryButton.style.background = 'rgba(135, 206, 250, 0.2)';
      shipSummaryButton.style.transform = 'scale(1)';
      shipSummaryButton.style.boxShadow = 'none';
    });

    shipSummaryButton.addEventListener('click', () => {
      if (!this.shipSummaryDialog) {
        this.shipSummaryDialog = new ShipSummaryDialog();
        window.shipSummaryDialog = this.shipSummaryDialog;
      }

      if (this.shipSummaryDialog.isOpen()) {
        this.shipSummaryDialog.hide();
      } else {
        this.shipSummaryDialog.show();
      }
    });

    // Add to container
    const container = document.getElementById('top-right-buttons');
    if (container) {
      container.appendChild(shipSummaryButton);
    }
  }

  /**
   * Get ThreeJS components (for external access if needed)
   */
  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }

  getMapGenerator() {
    return this.mapGenerator;
  }
}

