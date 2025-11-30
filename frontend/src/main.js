import { UIController } from './UIController.js';
import { eventBus } from './eventBus.js';
import { SystemEventHandler } from './events/SystemEventHandler.js';
import { GameEventHandler } from './events/GameEventHandler.js';
import { OrderEventHandler } from './events/OrderEventHandler.js';
import { TurnEventHandler } from './events/TurnEventHandler.js';
import { assetManager } from './engine/AssetManager.js';
import { webSocketManager } from './services/WebSocketManager.js';
import { getGameStateManager } from './services/GameStateManager.js';

const loadingScreen = 
{
  show: () => { document.getElementById('loading').style.display = 'block'; },
  hide: () => { document.getElementById('loading').style.display = 'none';  }
};

let uiController = new UIController('loading', loadingScreen);

let systemEventHandler = new SystemEventHandler();
let gameEventHandler = new GameEventHandler();
let orderEventHandler = new OrderEventHandler();
let turnEventHandler = new TurnEventHandler();

// Start loading assets immediately (before DOM ready)
console.log('🎨 Starting asset loading...');
assetManager.loadFont('fonts/helvetiker_regular.typeface.json');
assetManager.loadGLTF('models/toy_rocket_4k_free_3d_model_gltf/scene.gltf');

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () =>
{
   uiController.showScreen('splash');

   // Initialize GameStateManager singleton (starts listening to events)
   getGameStateManager();

   // Listen for login success to hide splash screen and show home page
   if (eventBus)
   {
      eventBus.on('auth:loginSuccess', (context, data) =>
      {
         uiController.showScreen('home');
         webSocketManager.connect();
      });

      // Listen for return to home event
      eventBus.on('game:returnToHome', () =>{ uiController.showScreen('home'); });
   }
});