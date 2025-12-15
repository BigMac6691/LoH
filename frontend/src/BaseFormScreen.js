/**
 * BaseFormScreen - Base class for form-based screens (Login, Register, Recover)
 * Provides common functionality for screen management, validation, and DOM structure
 */
import { eventBus } from './eventBus.js';
import { Utils } from './utils/Utils.js';

export class BaseFormScreen
{
   constructor(screenId)
   {
      this.container = null;
      this.isVisible = false;
      this.screenId = screenId;

      this.eventHandlers = []; // Track event handlers for cleanup
      this.inputControls = new Set();
   }

   /**
    * Create the base screen structure with logo area
    * Subclasses should call this and then add their form content
    * @returns {HTMLElement} The content div where subclasses can append their forms
    */
   createBaseScreen()
   {
      this.container = document.createElement('div');
      this.container.id = this.screenId;
      this.container.className = 'splash-screen';
      this.container.style.display = 'none';

      const content = document.createElement('div');
      content.className = 'splash-content';

      const logoArea = document.createElement('div');
      logoArea.className = 'splash-logo';
      logoArea.innerHTML = 
      `
      <div class="splash-title">⚔️ LoH ⚔️</div>
      <div class="splash-subtitle">Lords of Hyperspace</div>
      `;

      content.appendChild(logoArea);
      this.container.appendChild(content);
      document.body.appendChild(this.container);

      return content; // Return content so subclasses can append their forms
   }

   /**
    * Show the screen
    * @param {Object} parameters - Optional parameters (e.g., { email: 'user@example.com' })
    */
   show(parameters = {})
   {
      if (this.container)
      {
         this.container.style.display = 'flex';
         this.isVisible = true;
         this.onShow(parameters);
      }
      else
         throw new Error(`BaseFormScreen: Container for screen ${this.screenId} not found!`);
   }

   /**
    * Hide the screen
    */
   hide()
   {
      if (this.container)
      {
         this.container.style.display = 'none';
         this.isVisible = false;
         this.onHide();
      }
      else
         throw new Error(`BaseFormScreen: Container for screen ${this.screenId} not found!`);
   }

   /**
    * Hook for subclasses to handle show logic
    * @param {Object} parameters - Parameters passed to show()
    */
   onShow(parameters = {})
   {
      // Override in subclasses
   }

   /**
    * Hook for subclasses to handle hide logic
    */
   onHide()
   {
      // Override in subclasses
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

   /**
    * Show error message in an error div
    * @param {string} errorId - ID of the error div element
    * @param {string} message - Error message to display
    */
   showError(errorId, message)
   {
      const errorDiv = Utils.requireElement(errorId);

      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.className = 'login-error error-message';
   }

   /**
    * Clear error message
    * @param {string} errorId - ID of the error div element
    */
   clearError(errorId)
   {
      const errorDiv = Utils.requireElement(errorId);

      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
   }

   /**
    * Focus an input element after a short delay
    * @param {string} elementId - ID of the element to focus
    * @param {boolean} select - Whether to select the text (default: false)
    */
   focusInput(elementId, select = false)
   {
      setTimeout(() =>
      {
         const element = Utils.requireElement(elementId);

         element.focus();

         if (select && element.select)
            element.select();
      }, 100);
   }

   /**
    * Pre-fill an input field with a value
    * @param {string} elementId - ID of the input element
    * @param {string} value - Value to set
    */
   prefillInput(elementId, value)
   {
      const element = Utils.requireElement(elementId);

      element.value = value || '';
   }

   /**
    * Update button and input state (disabled/enabled and text)
    * @param {boolean} loading - Whether the view is loading
    * @param {string} email - Email to prefill
   */
   updateViewState(loading, email)
   {
      this.inputControls.forEach(control => control.disabled = loading);

      if (email)
         this.prefillInput(`#${this.screenId}-email`, email);
   }

   /**
    * Cleanup and dispose of the screen
    */
   dispose()
   {
      this.unregisterEventHandlers();

      this.inputControls = [];

      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);
   }
}
