import { DEV_MODE, autoStartDevMode, logDevModeStatus } from './devScenarios.js';
import { eventBus } from './eventBus.js';
import { assetManager } from './engine/AssetManager.js';
import { SplashScreen } from './SplashScreen.js';
import { HomePage } from './HomePage.js';
import { GameView } from './GameView.js';
import { webSocketManager } from './services/WebSocketManager.js';
import { getGameStateManager } from './services/GameStateManager.js';

// Global MapModel instance
window.globalMapModel = null;

// Global player lookup Map (playerId -> player object)
window.globalPlayers = null;

// Global instances
let splashScreen;
let homePage;
let gameView;

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

// Initialize splash screen early (before DOM ready)
// It will handle showing itself and tracking asset loading
if (typeof window !== 'undefined')
{
   // Wait for DOM to be ready to create splash screen
   if (document.readyState === 'loading')
   {
      document.addEventListener('DOMContentLoaded', () =>
      {
         splashScreen = new SplashScreen();
         splashScreen.init();
      });
   }
   else
   {
      // DOM already ready
      splashScreen = new SplashScreen();
      splashScreen.init();
   }
}

// Remove loading screen and start animation
document.addEventListener('DOMContentLoaded', () =>
{
   // Hide old loading element if it exists
   const loadingElement = document.getElementById('loading');
   if (loadingElement)
   {
      loadingElement.style.display = 'none';
   }

   // Initialize GameStateManager singleton (starts listening to events)
   getGameStateManager();

   // Initialize GameView (but don't show it yet)
   gameView = new GameView();
   gameView.init();

   // Make mapGenerator accessible globally for development scenarios
   if (gameView)
   {
      window.mapGenerator = gameView.getMapGenerator();
   }

   // Listen for login success to hide splash screen and show home page
   if (eventBus)
   {
      eventBus.on('auth:loginSuccess', (context, data) =>
      {
         if (splashScreen)
         {
            splashScreen.hide();
         }
         // Show home page after login
         homePage = new HomePage();
         homePage.init();
         // Make homePage accessible globally for profile updates
         window.homePage = homePage;

         // Connect WebSocket after login
         webSocketManager.connect();
      });

      // Listen for game:load event from home page (PLAY/JOIN buttons)
      // This handles UI switching - the actual game loading is handled by game:loadGame
      eventBus.on('game:load', (context, data) =>
      {
         const { gameId } = data;

         if (!gameId)
         {
            console.error('game:load event missing gameId');
            return;
         }

         // Hide home page
         if (homePage)
         {
            homePage.hide();
         }

         // Show game view
         if (gameView)
         {
            gameView.show();
         }

         // Emit game:loadGame to trigger actual game loading
         // GameEventHandler will handle loading and emit game:gameLoaded when done
         eventBus.emit('game:loadGame', { gameId });
      });

      // Listen for return to home event
      eventBus.on('game:returnToHome', () =>
      {
         // Show home page if it exists, otherwise create it
         if (!homePage)
         {
            homePage = new HomePage();
            homePage.init();
            window.homePage = homePage;
         }
         else
         {
            homePage.show();
         }

         // Show the Games Playing view
         homePage.showView('games-playing');

         console.log('🏠 Returned to home page and showing Games Playing view');
      });
   }

   // Log development mode status
   logDevModeStatus();

   // Don't auto-start in normal mode - wait for login
   // In dev mode, we can skip the splash screen
   if (DEV_MODE === 2)
   {
      // Hide splash screen in dev mode
      if (splashScreen)
      {
         splashScreen.hide();
      }

      // Show game view in dev mode
      if (gameView)
      {
         gameView.show();
      }

      // Start the development scenario immediately
      // Font loading will be handled by AssetManager events automatically
      autoStartDevMode();
   }
   // Normal flow - splash screen will show login, game starts after successful login
});

// Export GameView for potential use in other modules
export
{
   gameView
};
