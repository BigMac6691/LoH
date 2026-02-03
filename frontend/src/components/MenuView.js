/**
 * MenuView - Base class for all menu view components
 * Provides common functionality for components displayed in the home page menu
 */
import { eventBus } from '../eventBus.js';
import { RequestManager } from '../services/RequestManager.js';

export class MenuView
{
   constructor(statusComponent)
   {
      this.statusComponent = statusComponent;
      this.eventHandlers = [];
      this.domEventHandlers = [];
      this.requestManager = new RequestManager();
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
      this.eventHandlers.forEach(({ eventType, handler }) => eventBus.off(eventType, handler));
      this.eventHandlers = [];
   }

   /**
    * Register a DOM event listener and track it for cleanup
    * @param {Element} element - DOM element to attach listener to
    * @param {string} eventType - Event type to listen for
    * @param {Function} handler - Unbound event handler function
    */
   registerDomEventHandler(element, eventType, handler)
   {
      if (!element || typeof element.addEventListener !== 'function')
         throw new Error('MenuView: Invalid DOM element for event handler');

      const boundHandler = handler.bind(this);
      element.addEventListener(eventType, boundHandler);
      this.domEventHandlers.push({ element, eventType, handler: boundHandler });
   }

   /**
    * Unregister all tracked DOM event handlers
    */
   unregisterDomEventHandlers()
   {
      this.domEventHandlers.forEach(({ element, eventType, handler }) => element.removeEventListener(eventType, handler));
      this.domEventHandlers = [];
   }
}
