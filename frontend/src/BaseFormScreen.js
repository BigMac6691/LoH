/**
 * BaseFormScreen - Base class for form-based screens (Login, Register, Recover)
 * Provides common functionality for screen management, validation, and DOM structure
 */
import { eventBus } from './eventBus.js';

export class BaseFormScreen
{
   constructor(screenId)
   {
      this.container = null;
      this.isVisible = false;
      this.screenId = screenId;
      this.eventHandlers = []; // Track event handlers for cleanup
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
      logoArea.innerHTML = `
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
      this.eventHandlers.forEach(({ eventType, handler }) =>
      {
         eventBus.off(eventType, handler);
      });
      this.eventHandlers = [];
   }

   /**
    * Validate email address
    * @param {string} email - Email to validate
    * @returns {boolean} True if valid
    */
   validateEmail(email)
   {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
   }

   /**
    * Validate password strength
    * @param {string} password - Password to validate
    * @returns {Object} { valid: boolean, errors: string[] }
    */
   validatePassword(password)
   {
      const errors = [];
      if (!password || password.length < 8)
         errors.push('Password must be at least 8 characters long');
      if (password && !/[A-Z]/.test(password))
         errors.push('Password must contain at least one uppercase letter');
      if (password && !/[a-z]/.test(password))
         errors.push('Password must contain at least one lowercase letter');
      if (password && !/[0-9]/.test(password))
         errors.push('Password must contain at least one number');
      if (password && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password))
         errors.push('Password must contain at least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)');
      return { valid: errors.length === 0, errors };
   }

   /**
    * Show error message in an error div
    * @param {string} errorId - ID of the error div element
    * @param {string} message - Error message to display
    */
   showError(errorId, message)
   {
      const errorDiv = document.getElementById(errorId);
      if (errorDiv)
      {
         errorDiv.textContent = message;
         errorDiv.style.display = 'block';
         errorDiv.className = 'login-error error-message';
      }
   }

   /**
    * Clear error message
    * @param {string} errorId - ID of the error div element
    */
   clearError(errorId)
   {
      const errorDiv = document.getElementById(errorId);
      if (errorDiv)
      {
         errorDiv.style.display = 'none';
         errorDiv.textContent = '';
      }
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
         const element = document.getElementById(elementId);
         if (element)
         {
            element.focus();
            if (select && element.select)
               element.select();
         }
      }, 100);
   }

   /**
    * Pre-fill an input field with a value
    * @param {string} elementId - ID of the input element
    * @param {string} value - Value to set
    */
   prefillInput(elementId, value)
   {
      const element = document.getElementById(elementId);
      if (element && value)
         element.value = value;
   }

   /**
    * Update button state (disabled/enabled and text)
    * @param {string} buttonId - ID of the button
    * @param {boolean} disabled - Whether button should be disabled
    * @param {string} text - Button text (optional)
    */
   updateButtonState(buttonId, disabled, text)
   {
      const button = document.getElementById(buttonId);
      if (button)
      {
         button.disabled = disabled;
         if (text !== undefined)
            button.textContent = text;
      }
   }

   /**
    * Cleanup and dispose of the screen
    */
   dispose()
   {
      this.unregisterEventHandlers();
      if (this.container && this.container.parentNode)
         this.container.parentNode.removeChild(this.container);
   }
}
