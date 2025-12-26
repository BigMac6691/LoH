import * as THREE from 'three';
import { ApiEvent, ApiRequest } from './events/Events.js';
import { MapViewGenerator } from './MapViewGenerator.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEV_MODE, setupDevModeEventListeners } from './devScenarios.js';
import { eventBus } from './eventBus.js';
import { DevEventHandler } from './events/DevEventHandler.js';
import { DevPanel } from './dev/DevPanel.js';
import { TurnEventsPanel } from './TurnEventsPanel.js';
import { SummaryDialog } from './SummaryDialog.js';
import { OrderSummaryDialog } from './OrderSummaryDialog.js';
import { ShipSummaryDialog } from './ShipSummaryDialog.js';
import { webSocketManager } from './services/WebSocketManager.js';
import { Utils } from './utils/Utils.js';
import { MenuView } from './components/MenuView.js';
import { gameStateManager as GSM } from './services/GameStateManager.js';
/**
 * GameView - Manages the ThreeJS game map view and all game-related UI
 */
export class GameView extends MenuView
{
   constructor()
   {
      super();

      this.registerEventHandler('system:assetLoaded', this.handleAssetLoaded.bind(this));
      // this.registerEventHandler('game:gameReady', this.handleGameReady.bind(this));

      // Listen for WebSocket connection failure to start polling
      // eventBus.on('websocket:connectionFailed', () => { console.log('🔄 WebSocket connection failed, starting polling fallback'); });

      // ThreeJS components
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;

      // Game components
      this.mapGenerator = null;

      // UI components
      this.devPanel = null;
      this.turnEventsPanel = new TurnEventsPanel();
      this.summaryDialog = new SummaryDialog();
      this.orderSummaryDialog = new OrderSummaryDialog();
      this.shipSummaryDialog = new ShipSummaryDialog();

      // Animation
      this.animationFrameId = null;
      this.isVisible = false;

      // Canvas element
      this.canvas = null;
      this.topRightButtons = null;

      this.init();
   }

   /**
    * Initialize the game view (called once on app startup)
    */
   init()
   {
      this.canvas = document.getElementById('gameCanvas');
      if (!this.canvas)
         return eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Canvas element not found', type: 'error'})); // void function

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x1a1a2e);

      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.z = 500;

      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);

      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x999999, 0.3);
      this.scene.add(hemisphereLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
      directionalLight.position.copy(this.camera.position);
      this.scene.add(directionalLight);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement); // Initialize OrbitControls
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;

      this.mapGenerator = new MapViewGenerator(this.scene, this.camera); // Initialize game components
      
      if (DEV_MODE > 0) // Initialize dev panel if in dev mode
      {
         this.devEventHandler = new DevEventHandler();
         this.devPanel = new DevPanel(this.scene, this.renderer, this.camera, this.mapGenerator);
         setupDevModeEventListeners(this.playerManager);
      }

      this.setupResizeHandler(); // Set up window resize handler
      this.createButtons(); // Create top-right buttons
   }

   show()
   {
      console.log('🎮 GameView: Showing game view');

      if (this.isVisible) 
         return;

      this.isVisible = true;

      if (this.canvas)
         this.canvas.style.display = 'block';

      // Show button container
      Utils.requireElement('#top-right-buttons').style.display = 'flex';
      this.startAnimation(); // Start animation loop

      if (DEV_MODE > 0 && this.devPanel)
         this.devPanel.show(); // Show dev panel if in dev mode
   }

   hide()
   {
      if (!this.isVisible) 
         return;

      this.isVisible = false;

      if (this.canvas)
         this.canvas.style.display = 'none';

      Utils.requireElement('#top-right-buttons').style.display = 'none';

      // Stop animation loop
      this.stopAnimation();

      // Hide all dialogs
      if (this.turnEventsPanel && this.turnEventsPanel.isOpen())
         this.turnEventsPanel.hide();
      
      if (this.summaryDialog && this.summaryDialog.isOpen())
         this.summaryDialog.hide();
      
      if (this.orderSummaryDialog && this.orderSummaryDialog.isOpen())
         this.orderSummaryDialog.hide();
      
      if (this.shipSummaryDialog && this.shipSummaryDialog.isOpen())
         this.shipSummaryDialog.hide();
   }

   startAnimation()
   {
      console.log('🎮 GameView: Starting animation loop');

      if (this.animationFrameId) 
         return; // Already running

      const animate = () =>
      {
         if (!this.isVisible) 
            return; // Stop if hidden

         this.animationFrameId = requestAnimationFrame(animate);

         // Update OrbitControls
         this.controls.update();
         this.renderer.render(this.scene, this.camera);

         // Render star labels if map generator exists
         if (this.mapGenerator)
            this.mapGenerator.updateStarInteraction(0.016); // Approximate delta time
      };

      animate();
   }

   stopAnimation()
   {
      if (this.animationFrameId)
      {
         cancelAnimationFrame(this.animationFrameId);
         this.animationFrameId = null;
      }
   }

   setupResizeHandler()
   {
      window.addEventListener('resize', () =>
      {
         this.camera.aspect = window.innerWidth / window.innerHeight;
         this.camera.updateProjectionMatrix();
         this.renderer.setSize(window.innerWidth, window.innerHeight);

         // Update label renderer size
         if (this.mapGenerator)
         {
            this.mapGenerator.onWindowResize();
            this.mapGenerator.onStarInteractionResize();
         }
      });
   }

   handleGameReady(event)
   {
      console.log('🎮 GameView: Game ready event received:', event);

      if(event.data.refreshed)
         this.refreshLoad();
      else
         this.initialLoad();
   }

   handleAssetLoaded(event)
   {
      console.log('🎮 GameView: Asset loaded event received:', event);

      if (event.data.type === 'font')
      {
         this.mapGenerator.font = event.data.asset;
         this.mapGenerator.buildStarLabels();
      }
      else if (event.data.type === 'gltf')
      {
         this.mapGenerator.rocketModel = event.data.asset;
         this.mapGenerator.updateFleetIcons();
      }
   }

   initialLoad()
   {
      console.log('🎮 GameView: Initial load');

      this.mapGenerator.buildStaticMap();
      this.mapGenerator.updateFleetIcons();
      this.mapGenerator.positionCameraToFitMap();

      console.log('🎮 GameView: Current player:', GSM, GSM.currentPlayer, GSM.currentPlayerId, GSM.playersMap);

      Utils.requireChild(this.topRightButtons,'#end-turn-button').disabled = GSM.currentPlayer.status !== 'active';
   }

   refreshLoad()
   {
      console.log('🎮 GameView: Refresh load');
      
      // Re-enable all buttons
      Utils.requireChild(this.topRightButtons,'fieldset').disabled = false;
      Utils.requireChild(this.topRightButtons,'#end-turn-button').disabled = GSM.currentPlayer.status !== 'active';
   }

   createButtons()
   {
      this.topRightButtons = document.createElement('div');
      this.topRightButtons.id = 'top-right-buttons';
      this.topRightButtons.className = 'top-right-buttons-container';
      this.topRightButtons.style.display = 'none';
      this.topRightButtons.innerHTML = buttonsHTML;
      
      Utils.requireChild(this.topRightButtons,'#home-button').addEventListener('click', this.handleHomeButton.bind(this));
      Utils.requireChild(this.topRightButtons,'#end-turn-button').addEventListener('click', this.handleEndTurnButton.bind(this));
      Utils.requireChild(this.topRightButtons,'#ship-summary-button').addEventListener('click', () => {this.shipSummaryDialog.show()});
      Utils.requireChild(this.topRightButtons,'#order-button').addEventListener('click', () => {this.orderSummaryDialog.show()});
      Utils.requireChild(this.topRightButtons,'#summary-button').addEventListener('click', () => {this.summaryDialog.show()});
      Utils.requireChild(this.topRightButtons,'#events-button').addEventListener('click', () => {this.turnEventsPanel.show()});
      Utils.requireChild(this.topRightButtons,'#refresh-button').addEventListener('click', this.handleRefreshButton.bind(this));

      document.body.appendChild(this.topRightButtons);
   }

   handleHomeButton()
   {
      webSocketManager.leaveGame();

      this.mapGenerator.clearMap();
      this.hide();

      eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'home'}));
   }

   /**
    * Disables all the buttons, they will be re-enabled when the refresh is complete
    */
   handleRefreshButton()
   {
      Utils.requireChild(this.topRightButtons,'fieldset').disabled = true;
      eventBus.emit('game:requestRefresh', new ApiRequest('game:requestRefresh', {}));
   }

   /**
    * Disables the end turn button, it will be re-enabled when all players have ended their turns and we receive the new state via refresh
    */
   handleEndTurnButton()
   {
      Utils.requireChild(this.topRightButtons,'#end-turn-button').disabled = true;
      //Utils.requireChild(this.topRightButtons,'fieldset').disabled = true; // may need to do this until we know if all players have ended their turns
      eventBus.emit('turn:endTurn', new ApiRequest('turn:endTurn', {}));
   }

   dispose()
   {
      this.stopAnimation();
      this.mapGenerator.dispose();
      this.devPanel?.dispose();
      this.turnEventsPanel?.dispose();
      this.summaryDialog?.dispose();
      this.orderSummaryDialog?.dispose();
      this.shipSummaryDialog?.dispose();
   }
}

const buttonsHTML = `
   <fieldset>
      <button id="home-button" class="top-right-button top-right-button-home">🏠 Home</button>
      <button id="end-turn-button" class="top-right-button top-right-button-end-turn">✅ End Turn</button>
      <button id="refresh-button" class="top-right-button top-right-button-refresh">🔄 Refresh</button>
      <button id="ship-summary-button" class="top-right-button top-right-button-ship">🚢 Ships</button>
      <button id="order-button" class="top-right-button top-right-button-order">📋 Orders</button>
      <button id="summary-button" class="top-right-button top-right-button-summary">📊 Summary</button>
      <button id="events-button" class="top-right-button top-right-button-events">📝 Events</button>
   </fieldset>
`;