import { UIController } from './UIController.js';
import { GameController } from './services/GameController.js';
import { GameSession } from './services/GameSession.js';
import { ApiEvent, ApiRequest } from './events/Events.js';
import { eventBus } from './eventBus.js';
import { SystemEventHandler } from './events/SystemEventHandler.js';
import { GameEventHandler } from './events/GameEventHandler.js';
import { OrderEventHandler } from './events/OrderEventHandler.js';
import { TurnEventHandler } from './events/TurnEventHandler.js';
import { getGameStateManager } from './services/GameStateManager.js';
import { SessionController } from './services/SessionController.js';

// Global handler for runtime errors (e.g., undefined variable, throw new Error)
window.onerror = function (message, source, lineno, colno, error) 
{
   const errorData = { message: message, source: source, lineno: lineno, colno: colno, error: error };
   console.error("[onerror handler] ", errorData);

   eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', { ...errorData, type: 'error'}));
   
   // return true to suppress default browser handling (optional)
   return true;
};

// Global handler for unhandled promise rejections
window.onunhandledrejection = function (event) 
{
   const errorData = { reason: event.reason, promise: event.promise };
   console.error("[unhandledrejection handler] ", errorData);
   
   eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', { ...errorData, type: 'reject'}));

   // return true to suppress default browser handling (optional)
   return true;
};

const loadingScreen = 
{
  show: () => { document.getElementById('loading').style.display = 'block'; },
  hide: () => { document.getElementById('loading').style.display = 'none';  }
};

const sessionController = new SessionController();
const uiController = new UIController('loading', loadingScreen);

const systemEventHandler = new SystemEventHandler();
const gameEventHandler = new GameEventHandler();
const orderEventHandler = new OrderEventHandler();
const turnEventHandler = new TurnEventHandler();

const controller = new GameController(eventBus, gameEventHandler, GameSession);

// Start loading assets immediately (before DOM ready)
eventBus.emit('system:loadAsset', new ApiRequest('system:loadAsset', {type: "font", asset: 'fonts/helvetiker_regular.typeface.json'}));
eventBus.emit('system:loadAsset', new ApiRequest('system:loadAsset', {type: "gltf", asset: 'models/toy_rocket_4k_free_3d_model_gltf/scene.gltf'}));

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () =>
{
   uiController.showScreen('splash');

   // Initialize GameStateManager singleton (starts listening to events)
   getGameStateManager();

   console.log('🔍 Main: DOMContentLoaded', eventBus.listeners);
});