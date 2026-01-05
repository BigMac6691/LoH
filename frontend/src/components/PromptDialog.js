/**
 * PromptDialog - A modal dialog that prompts the user for text input
 * Behaves like window.prompt() but with custom styling
 * 
 * Usage:
 *   const dialog = new PromptDialog({
 *     title: 'Enter Name',
 *     message: 'Please enter your name:',
 *     defaultValue: 'John Doe'
 *   });
 *   const result = await dialog.show();
 *   if (result !== null) {
 *     console.log('User entered:', result);
 *   } else {
 *     console.log('User cancelled');
 *   }
 */
import { Utils } from '../utils/Utils.js';

export class PromptDialog
{
   /**
    * Create a new prompt dialog
    * @param {Object} options - Dialog configuration options
    * @param {string} options.title - Dialog title
    * @param {string} options.message - Message to display above the input
    * @param {string} [options.defaultValue] - Default value for the input field
    * @param {string} [options.placeholder] - Placeholder text for the input field
    * @param {string} [options.okText] - Text for the OK button (default: 'OK')
    * @param {string} [options.cancelText] - Text for the Cancel button (default: 'Cancel')
    */
   constructor(options = {})
   {
      this.dialog = document.createElement('dialog');
      this.dialog.className = 'prompt-dialog';
      
      // Drag state
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      
      // Apply default styles to match existing appearance
      // Note: For draggable dialogs, we need to use fixed positioning
      this.dialog.style.cssText = 
      `  position: fixed;
         top: 50%;
         left: 50%;
         transform: translate(-50%, -50%);
         background: rgba(0, 0, 0, 0.95);
         border: 2px solid #00ff88;
         border-radius: 15px;
         padding: 30px;
         color: white;
         min-width: 400px;
         max-width: 500px;
         backdrop-filter: blur(10px);
         font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
         margin: 0;
      `;

      const title = options.title || 'Prompt';
      const message = options.message || '';
      const defaultValue = options.defaultValue || '';
      const placeholder = options.placeholder || '';
      const okText = options.okText || 'OK';
      const cancelText = options.cancelText || 'Cancel';

      // Build dialog HTML structure
      // Title will be the drag handle
      this.dialog.innerHTML = 
      `  <h2 class="prompt-drag-handle" style="margin: 0 0 20px 0; color: #00ff88; text-align: center; cursor: move; user-select: none; padding: 5px;">${Utils.escapeHtml(title)}</h2>
         ${message ? `<p style="margin: 0 0 20px 0; color: #ffffff; line-height: 1.5;">${Utils.escapeHtml(message)}</p>` : ''}
         <input type="text" 
                class="prompt-input" 
                value="${Utils.escapeHtml(defaultValue)}" 
                placeholder="${Utils.escapeHtml(placeholder)}"
                style="width: 100%; padding: 10px; margin-bottom: 20px; background: rgba(255, 255, 255, 0.1); border: 1px solid #00ff88; border-radius: 5px; color: white; font-size: 14px; box-sizing: border-box;"
                autofocus>
         <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="cancel-dialog-btn">${Utils.escapeHtml(cancelText)}</button>
            <button type="button" id="prompt-ok-btn" class="pagination-btn">${Utils.escapeHtml(okText)}</button>
         </div>
      `;

      // Get references to elements
      this.dragHandle = this.dialog.querySelector('.prompt-drag-handle');
      this.input = this.dialog.querySelector('.prompt-input');
      this.okBtn = this.dialog.querySelector('#prompt-ok-btn');
      this.cancelBtn = this.dialog.querySelector('.cancel-dialog-btn');

      // Setup event handlers
      this.setupEventHandlers();
      this.setupDragHandlers();

      // Promise to track user response
      this.resolvePromise = null;
      this.rejectPromise = null;
   }

   /**
    * Setup event handlers for dialog
    */
   setupEventHandlers()
   {
      // OK button - resolve with input value
      this.okBtn.addEventListener('click', () => { this.close(this.input.value); });

      // Cancel button - resolve with null
      this.cancelBtn.addEventListener('click', () => { this.close(null); });

      // Enter key in input - same as OK
      this.input.addEventListener('keydown', (e) =>
      {
         if (e.key === 'Enter')
         {
            e.preventDefault();
            const value = this.input.value;
            this.close(value);
         }
      });

      // Escape key - same as Cancel (native dialog behavior)
      this.dialog.addEventListener('cancel', (e) =>
      {
         e.preventDefault();
         this.close(null);
      });
   }

   /**
    * Setup drag handlers for the dialog
    * Uses the title (h2) as the drag handle
    */
   setupDragHandlers()
   {
      this.dragHandle.addEventListener('mousedown', (e) =>
      {
         if (this.dialog === null) 
            return;

         this.isDragging = true;
         const rect = this.dialog.getBoundingClientRect();
         this.dragOffset = 
         {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
         };
         e.preventDefault();
      });

      // Use document-level listeners to handle dragging outside the dialog
      const handleMouseMove = (e) =>
      {
         if (!this.isDragging) 
            return;

         const x = e.clientX - this.dragOffset.x;
         const y = e.clientY - this.dragOffset.y;

         // Keep dialog within viewport bounds
         const maxX = window.innerWidth - this.dialog.offsetWidth;
         const maxY = window.innerHeight - this.dialog.offsetHeight;

         const clampedX = Math.max(0, Math.min(x, maxX));
         const clampedY = Math.max(0, Math.min(y, maxY));

         this.dialog.style.left = clampedX + 'px';
         this.dialog.style.top = clampedY + 'px';
         this.dialog.style.transform = 'none';
      };

      const handleMouseUp = () => { this.isDragging = false; };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // Store handlers for cleanup
      this._dragMouseMoveHandler = handleMouseMove;
      this._dragMouseUpHandler = handleMouseUp;
   }

   /**
    * Show the dialog and return a Promise that resolves with the user's input
    * @returns {Promise<string|null>} Promise that resolves with the input value (or null if cancelled)
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
         
         // Focus the input field
         this.input.focus();
         this.input.select();
      });
   }

   /**
    * Close the dialog with a result value
    * @param {string|null} value - The value to return (null for cancel)
    * @private
    */
   close(value)
   {
      this.dialog.close();
      
      // Clean up drag handlers
      if (this._dragMouseMoveHandler)
      {
         document.removeEventListener('mousemove', this._dragMouseMoveHandler);
         this._dragMouseMoveHandler = null;
      }
      if (this._dragMouseUpHandler)
      {
         document.removeEventListener('mouseup', this._dragMouseUpHandler);
         this._dragMouseUpHandler = null;
      }
      
      if (this.dialog.parentNode)
         this.dialog.parentNode.removeChild(this.dialog);

      // Resolve the promise with the value
      if (this.resolvePromise)
      {
         this.resolvePromise(value);
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

   /**
    * Get the input element
    * @returns {HTMLInputElement}
    */
   getInput()
   {
      return this.input;
   }
}

