/**
 * MenuView - Base class for all menu view components
 * Provides common functionality for components displayed in the home page menu
 */
import { eventBus } from '../eventBus.js';

export class MenuView
{
   constructor(statusComponent)
   {
      this.statusComponent = statusComponent;
      this.eventHandlers = [];
   }

   /**
    * Display a status message in the status component
    * @param {string} message - Message to display
    * @param {string} type - Message type: 'info', 'success', 'error', 'warning' (default: 'info')
    */
   displayStatusMessage(message, type = 'info')
   {
      if (this.statusComponent && this.statusComponent.postStatusMessage)
         this.statusComponent.postStatusMessage(message, type);
      else // Fallback to alert if statusComponent is not available
         alert(message);
   }

   /**
    * Register an event listener and track it for cleanup
    * @param {string} eventType - Event type to listen for
    * @param {Function} handler - Event handler function
    */
   registerEventHandler(eventType, handler)
   {
      const boundHandler = handler.bind(this);
      eventBus.on(eventType, boundHandler);
      this.eventHandlers.push({ eventType, handler: boundHandler });
   }

   /**
    * Unregister all tracked event handlers
    */
   unregisterEventHandlers()
   {
      this.eventHandlers.forEach(({ eventType, handler }) => { eventBus.off(eventType, handler); });
      this.eventHandlers = [];
   }
}
