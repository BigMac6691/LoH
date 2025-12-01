/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus } from '../eventBus.js';
import { ApiEvent, ApiResponse } from './Events.js';

export class SystemEventHandler
{
   constructor()
   {
      this.userLoggedIn = false;
    
      this.setupEventListeners();
   }

   /**
    * Set up event listeners for system events
    */
   setupEventListeners()
   {
      eventBus.on('system:login', this.handleLogin.bind(this));
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
   }

   /**
    * Handle all assets loaded event, if no user has logged in, emit system:systemReady event
    * @param {ApiResponse} event - Event object
    */
   handleAllAssetsLoaded(event)
   {
      console.log('🔐 SystemEventHandler: All assets loaded:', event, event.response);

      if(!this.userLoggedIn)
        eventBus.emit('system:systemReady', new ApiEvent('system:systemReady'));
   }

   /**
    * Handle user login event
    * @param {Object} userData - User data from login
    */
   handleLogin(userData)
   {
      console.log('🔐 SystemEventHandler: Processing login for user:', userData);

      // Emit user ready event
      eventBus.emit('system:userReady', new ApiResponse('system:userReady', userData, 200));
   }

   /**
    * Clean up event listeners
    */
   dispose()
   {
      eventBus.off('system:login', this.handleLogin.bind(this));
      eventBus.off('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
   }
}
