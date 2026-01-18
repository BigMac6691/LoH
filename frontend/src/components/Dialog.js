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
    */
   constructor(options = {})
   {
      this.dialog = document.createElement('dialog');
      this.dialog.className = options.className || 'app-dialog';
      this.dialog.style.cssText = `${dialogCSS} ${options.styles || ''}`;
      this.dialog.innerHTML = 
      `  <h2 style="margin: 0 0 20px 0; color: #00ff88; text-align: center;">${options.title || 'Dialog'}</h2>
         ${options.contentHTML || ''}
      `;

      // Insert buttons after the fieldset element
      const buttonsHTML = getBottomButtonsHTML(options.buttonText || 'Save');
      Utils.requireChild(this.dialog, 'fieldset').insertAdjacentHTML('afterend', buttonsHTML);

      // Promise tracking for async show()
      this.resolvePromise = null;
      this.rejectPromise = null;

      this.setupEventHandlers();
   }

   setupEventHandlers()
   {
      // Cancel button - resolve with false
      const cancelBtn = Utils.requireChild(this.dialog, '.cancel-dialog-btn');
      cancelBtn.addEventListener('click', () =>
      {
         this.close(false);
      });

      // Close on Escape key (native dialog behavior)
      this.dialog.addEventListener('cancel', (e) =>
      {
         e.preventDefault();
         this.close(false);
      });

      // Note: Save button is handled by the caller, not here
      // The caller should call close(true) when save succeeds
   }

   /**
    * Show the dialog and return a Promise that resolves when the dialog is closed
    * @returns {Promise<boolean>} Promise that resolves with true if Save was clicked, false if Cancel/Escape
    */
   show()
   {
      return new Promise((resolve, reject) =>
      {
         this.resolvePromise = resolve;
         this.rejectPromise = reject;

         if (!this.dialog.parentNode)
            document.body.appendChild(this.dialog);
         
         this.dialog.showModal();
      });
   }

   /**
    * Close the dialog with a result value
    * @param {boolean} saved - Whether the dialog was saved (true) or cancelled (false)
    * @private
    */
   close(saved = false)
   {
      this.dialog.close();
      
      if (this.dialog.parentNode)
         this.dialog.parentNode.removeChild(this.dialog);
      
      // Resolve the promise with the result
      if (this.resolvePromise)
      {
         this.resolvePromise(saved);
         this.resolvePromise = null;
         this.rejectPromise = null;
      }
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
      Utils.requireChild(this.dialog, '#save-dialog-btn').disabled = state;
   }

   // Re-center the dialog after dynamic content changes, slight unfortunate side effect is the dialog will flash when it re-renders very briefly.
   recenter()
   {
      if (!this.dialog || !this.dialog.open)
         return;

      // The native dialog element with showModal() centers automatically.  Use requestAnimationFrame to ensure the DOM has fully updated
      requestAnimationFrame(() =>
      {
         this.dialog.style.top = '';
         this.dialog.style.left = '';
         this.dialog.style.transform = '';
         this.dialog.showModal();
      });
   }
}

const getBottomButtonsHTML = (buttonText) =>
`  <div style="display: flex; gap: 10px; justify-content: flex-end;">
    <button type="button" class="cancel-dialog-btn">Cancel</button>
    <button type="submit" id="save-dialog-btn">${buttonText}</button>
  </div>
`;

const dialogCSS = `  background: rgba(0, 0, 0, 0.95);
         border: 2px solid #00ff88;
         border-radius: 15px;
         padding: 30px;
         color: white;
         min-width: 400px;
         max-width: 500px;
         max-height: 90vh;
         overflow-y: auto;
         backdrop-filter: blur(10px);
         font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
         margin: auto;
      `;