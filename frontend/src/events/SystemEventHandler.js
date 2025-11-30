/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus } from '../eventBus.js';
import { ApiResponse } from './Events.js';

export class SystemEventHandler
{
   constructor()
   {
      // Set up event listeners
      this.setupEventListeners();
   }

   /**
    * Set up event listeners for system events
    */
   setupEventListeners()
   {
      // Listen for login events
      eventBus.on('system:login', this.handleLogin.bind(this));
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
   }

   handleAllAssetsLoaded(event)
   {
      console.log('🔐 SystemEventHandler: All assets loaded:', event, event.response);
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
