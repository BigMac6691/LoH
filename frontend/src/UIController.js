import { eventBus } from './eventBus.js';
import { SplashScreen } from './SplashScreen.js';
import { HomePage } from './HomePage.js';
import { GameView } from './GameView.js';

/**
 * UIController - Handles UI interactions for map generation
 */
export class UIController
{
   constructor(key, initialScreen)
   {
      this.currentScreen = initialScreen;
      this.screens = new Map();
      
      this.registerScreen(key, initialScreen);
      this.init();
   }

   /**
    * Initialize the UI controller
    */
   init()
   {
      this.registerScreen('splash', new SplashScreen());
      this.registerScreen('home', new HomePage());
      this.registerScreen('game', new GameView());

      // Initialize event listeners
      this.initializeEventListeners();
   }

   /**
    * Initialize all event listeners for the UI
    */
   initializeEventListeners()
   {
      
      eventBus.on('system:assetLoaded', this.handleAssetLoaded.bind(this));
      eventBus.on('system:assetLoading', this.handleAssetLoading.bind(this));
      // eventBus.on('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.on('ui:showScreen', this.handleShowScreen.bind(this));
   }

   handleShowScreen(event)
   {
      console.log('🔐 UIController: Show screen:', event);

      this.showScreen(event.request);
   }

   handleLoginResponse(event)
   {
      console.log('🔐 UIController: Login response:', event, event.response);
   }

   handleAssetLoaded(event)
   {
      console.log('🔐 UIController: Asset loaded:', event, event.response);
   }

   handleAssetLoading(event)
   {
      console.log('🔐 UIController: Asset loading:', event, event.response);
   }

   handleSystemReady(event)
   {
      console.log('🔐 UIController: System ready:', event, event.response);
   }

   registerScreen(key, screen)
   {
      this.screens.set(key, screen);
   }

   getScreen(key)
   {
      return this.screens.get(key);
   }

   showScreen(key)
   {
      if (!this.screens.has(key))
         throw new ApiError(`Screen ${key} not found`);

      this.currentScreen.hide();
      this.currentScreen = this.screens.get(key);
      this.currentScreen.show();
   }

   dispose()
   {
      eventBus.off('system:assetLoaded', this.handleAssetLoaded.bind(this));
      eventBus.off('system:assetLoading', this.handleAssetLoading.bind(this));
      eventBus.off('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.off('ui:showScreen', this.handleShowScreen.bind(this));
   }
}
