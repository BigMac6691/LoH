import { UIController } from './UIController.js';
import { ApiRequest } from './events/Events.js';
import { eventBus } from './eventBus.js';
import { SystemEventHandler } from './events/SystemEventHandler.js';
import { GameEventHandler } from './events/GameEventHandler.js';
import { OrderEventHandler } from './events/OrderEventHandler.js';
import { TurnEventHandler } from './events/TurnEventHandler.js';
import { getGameStateManager } from './services/GameStateManager.js';

// Global handler for runtime errors (e.g., undefined variable, throw new Error)
window.onerror = function (message, source, lineno, colno, error) 
{
   console.error("[onerror handler] ", {message, source, lineno, colno, error});
   
   // return true to suppress default browser handling (optional)
   return true;
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = function (event) 
{
   console.error("[unhandledrejection handler] ", {reason: event.reason, promise: event.promise});
   
   // return true to suppress default browser handling (optional)
   return true;
};

const loadingScreen = 
{
  show: () => { document.getElementById('loading').style.display = 'block'; },
  hide: () => { document.getElementById('loading').style.display = 'none';  }
};

const uiController = new UIController('loading', loadingScreen);

const systemEventHandler = new SystemEventHandler();
const gameEventHandler = new GameEventHandler();
const orderEventHandler = new OrderEventHandler();
const turnEventHandler = new TurnEventHandler();

// Start loading assets immediately (before DOM ready)
console.log('🎨 Starting asset loading...');
eventBus.emit('system:loadAsset', new ApiRequest('system:loadAsset', { type: "font", asset: 'fonts/helvetiker_regular.typeface.json'}));
eventBus.emit('system:loadAsset', new ApiRequest('system:loadAsset', { type: "gltf", asset: 'models/toy_rocket_4k_free_3d_model_gltf/scene.gltf'}));

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () =>
{
   uiController.showScreen('splash');

   // Initialize GameStateManager singleton (starts listening to events)
   getGameStateManager();
});