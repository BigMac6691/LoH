import { eventBus } from './eventBus.js';
import { SplashScreen } from './SplashScreen.js';
import { LoginScreen } from './LoginScreen.js';
import { RegisterScreen } from './RegisterScreen.js';
import { RecoverScreen } from './RecoverScreen.js';
import { HomePage } from './HomePage.js';
import { GameView } from './GameView.js';
import { ApiError } from './utils/RequestBuilder.js';

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
      this.registerScreen('login', new LoginScreen());
      this.registerScreen('register', new RegisterScreen());
      this.registerScreen('recover', new RecoverScreen());
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

   handleLoginResponse(event) // may need to drop this
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

   showScreen(screenConfig)
   {
      // Support object format: {targetScreen: "screen", parameters: {...}}
      const screenName = screenConfig.targetScreen || screenConfig;
      const parameters = screenConfig.parameters || {};

      if (!this.screens.has(screenName))
         throw new ApiError(`Screen ${screenName} not found`);

      this.currentScreen.hide();
      this.currentScreen = this.screens.get(screenName);
      this.currentScreen.show(parameters);
   }

   dispose()
   {
      eventBus.off('system:assetLoaded', this.handleAssetLoaded.bind(this));
      eventBus.off('system:assetLoading', this.handleAssetLoading.bind(this));
      eventBus.off('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.off('ui:showScreen', this.handleShowScreen.bind(this));
   }
}
