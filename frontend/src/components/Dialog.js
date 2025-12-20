/**
 * Dialog - Base class for modal dialogs using HTML <dialog> element
 * Provides common functionality for creating, showing, and managing dialogs
 */
import { Utils } from '../utils/Utils.js';

export class Dialog
{
   /**
    * Create a new dialog
    * @param {Object} options - Dialog configuration options
    * @param {string} options.title - Dialog title
    * @param {string} options.contentHTML - HTML content for the dialog body
    * @param {string} options.className - Optional CSS class name for the dialog
    * @param {string} options.styles - Optional custom styles string (appended to default styles)
    * @param {Function} options.onClose - Optional callback function called when dialog is closed
    */
   constructor(options = {})
   {
      this.dialog = document.createElement('dialog');
      this.dialog.className = options.className || 'app-dialog';
      
      // Apply default styles to match existing appearance
      this.dialog.style.cssText = 
      `  background: rgba(0, 0, 0, 0.95);
         border: 2px solid #00ff88;
         border-radius: 15px;
         padding: 30px;
         color: white;
         min-width: 400px;
         max-width: 500px;
         backdrop-filter: blur(10px);
         font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
         ${options.styles || ''}
      `;

      // Build dialog HTML structure (without buttons initially)
      this.dialog.innerHTML = 
      `  <h2 style="margin: 0 0 20px 0; color: #00ff88; text-align: center;">${options.title || 'Dialog'}</h2>
         ${options.contentHTML || ''}
      `;

      // Insert buttons after the fieldset element
      const buttonsHTML = getBottomButtonsHTML(options.buttonText || 'Save');
      Utils.requireChild(this.dialog, 'fieldset').insertAdjacentHTML('afterend', buttonsHTML);

      this.onClose = options.onClose;

      // Setup event handlers
      this.setupEventHandlers();
   }

   /**
    * Setup event handlers for dialog
    */
   setupEventHandlers()
   {
      // Close on Escape key (native dialog behavior)
      this.dialog.addEventListener('cancel', (e) =>
      {
         e.preventDefault();
         this.close();
      });
   }

   show()
   {
      if (!this.dialog.parentNode)
         document.body.appendChild(this.dialog);
      
      this.dialog.showModal();
   }

   close()
   {
      this.dialog.close();
      
      if (this.dialog.parentNode)
         this.dialog.parentNode.removeChild(this.dialog);
      
      // Call onClose callback if provided
      if (this.onClose)
         this.onClose();
   }

   /**
    * Get the dialog element
    * @returns {HTMLDialogElement}
    */
   getDialog()
   {
      return this.dialog;
   }

   setDisabled(state)
   {
      Utils.requireChild(this.dialog, 'fieldset').disabled = state;
      Utils.requireChild(this.dialog, '.save-dialog-btn').disabled = state;
   }
}

const getBottomButtonsHTML = (buttonText) =>
`  <div style="display: flex; gap: 10px; justify-content: flex-end;">
    <button type="button" class="cancel-dialog-btn">Cancel</button>
    <button type="submit" class="save-dialog-btn">${buttonText}</button>
  </div>
`